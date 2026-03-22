#!/usr/bin/env python3
"""
content-ideator.py

Reads trends, inbox messages, hooks, and existing ideas from Mission Control,
then calls Claude to generate complete content ideas with hooks and scripts,
and writes them back to Mission Control. Runs on THOTH every morning at 6am.

Usage:
    python content-ideator.py
    python content-ideator.py --dry-run
    python content-ideator.py --count 3
"""

import sys
import os
import argparse
import logging
import json
import re
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------

def check_deps():
    missing = []
    try:
        import requests  # noqa: F401
    except ImportError:
        missing.append("requests")
    try:
        import anthropic  # noqa: F401
    except ImportError:
        missing.append("anthropic")
    if missing:
        print(f"[ERROR] Missing pip packages: {', '.join(missing)}")
        print(f"        Run: pip install {' '.join(missing)}")
        sys.exit(1)

check_deps()

import requests
import anthropic

# ---------------------------------------------------------------------------
# Config / Env
# ---------------------------------------------------------------------------

# Load .env from ~/job-automation/.env if it exists
_env_path = Path.home() / "job-automation" / ".env"
if _env_path.exists():
    try:
        with open(_env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val
    except Exception as exc:
        print(f"[WARN] Could not parse .env file at {_env_path}: {exc}")

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MISSION_CONTROL_URL = os.environ.get(
    "MISSION_CONTROL_URL", "https://mission-control-app-theta.vercel.app"
).rstrip("/")

CLAUDE_MODEL = "claude-haiku-4-5"

OBSIDIAN_VAULT_BASE = Path.home() / "obsidian-vault" / "Content"

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "MissionControlIdeator/1.0",
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("content-ideator")

# ---------------------------------------------------------------------------
# Mission Control API helpers
# ---------------------------------------------------------------------------


def mc_get(path: str) -> list | dict:
    """GET from Mission Control, return parsed JSON."""
    url = f"{MISSION_CONTROL_URL}{path}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        log.warning(f"GET {path} failed: {exc}")
        return []


def mc_post(path: str, payload: dict, dry_run: bool) -> bool:
    """POST to Mission Control. Returns True on success (or in dry-run)."""
    url = f"{MISSION_CONTROL_URL}{path}"
    if dry_run:
        log.info(f"[DRY-RUN] Would POST to {path}: {json.dumps(payload)[:200]}")
        return True
    try:
        resp = requests.post(url, headers=HEADERS, json=payload, timeout=20)
        resp.raise_for_status()
        return True
    except requests.HTTPError as exc:
        log.error(f"POST {path} HTTP error: {exc} — {exc.response.text[:300]}")
        return False
    except Exception as exc:
        log.error(f"POST {path} error: {exc}")
        return False


def mc_patch(path: str, payload: dict, dry_run: bool) -> bool:
    """PATCH to Mission Control. Returns True on success (or in dry-run)."""
    url = f"{MISSION_CONTROL_URL}{path}"
    if dry_run:
        log.info(f"[DRY-RUN] Would PATCH {path}: {json.dumps(payload)[:200]}")
        return True
    try:
        resp = requests.patch(url, headers=HEADERS, json=payload, timeout=20)
        resp.raise_for_status()
        return True
    except requests.HTTPError as exc:
        log.error(f"PATCH {path} HTTP error: {exc} — {exc.response.text[:300]}")
        return False
    except Exception as exc:
        log.error(f"PATCH {path} error: {exc}")
        return False


# ---------------------------------------------------------------------------
# Data extraction helpers
# ---------------------------------------------------------------------------


def extract_list(data) -> list:
    """Normalize API response to a plain list."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("data", "items", "results", "trends", "hooks", "ideas", "messages"):
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


def get_id(item: dict) -> str | None:
    """Return the id of a Mission Control item."""
    return item.get("id") or item.get("_id") or item.get("uuid")


# ---------------------------------------------------------------------------
# Step 1: Gather context
# ---------------------------------------------------------------------------


def gather_context() -> dict:
    log.info("Step 1: Gathering context from Mission Control...")

    raw_trends = extract_list(mc_get("/api/content/trends"))
    # Only undeveloped trends
    trends = [t for t in raw_trends if not t.get("developed", False)]
    log.info(f"  Trends (undeveloped): {len(trends)}")

    raw_inbox = extract_list(mc_get("/api/content/inbox"))
    # Only pending inbox messages
    inbox = [m for m in raw_inbox if m.get("status", "pending") == "pending"]
    log.info(f"  Inbox (pending): {len(inbox)}")

    hooks = extract_list(mc_get("/api/content/hooks"))
    log.info(f"  Hooks: {len(hooks)}")

    raw_ideas = extract_list(mc_get("/api/content"))
    # Last 10 existing ideas for dedup context
    existing_ideas = raw_ideas[:10] if len(raw_ideas) >= 10 else raw_ideas
    log.info(f"  Existing ideas (showing last 10 of {len(raw_ideas)}): {len(existing_ideas)}")

    return {
        "trends": trends,
        "inbox": inbox,
        "hooks": hooks,
        "existing_ideas": existing_ideas,
    }


# ---------------------------------------------------------------------------
# Step 2: Build Claude prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are Thoth, Jaivien Kendrick's content strategist and scriptwriter.

About Jaivien:
- AI entrepreneur and content creator based in Baltimore, MD
- Runs More Life Consulting — builds AI systems and automation for businesses
- Niche: Making AI practical and accessible, especially for Black entrepreneurs and everyday people
- Building in public — shares real wins, real failures, real lessons
- Voice: Real, direct, conversational. Not corporate. Speaks to people who are actually building something.
- Target audience: 18-35 Black entrepreneurs, side hustlers, creators who want to use AI to build real income

Content philosophy:
- Personal story > generic tutorial
- Specific > vague (say "I saved 3 hours" not "AI is useful")
- Show the system, not just the tool
- The hook is everything — first 3 seconds decide everything
- End with a lesson or a CTA that makes people think

Platforms: Primarily TikTok + Instagram Reels (60-90 seconds). Sometimes LinkedIn posts.

Your job: Generate complete content ideas with hooks and full scripts."""


def build_user_message(context: dict, count: int) -> str:
    lines = ["Here is today's content context:", ""]

    # Trends
    lines.append("TRENDING TOPICS:")
    if context["trends"]:
        for t in context["trends"]:
            topic = t.get("topic", "")
            platform = t.get("platform", "")
            description = t.get("description", "")
            lines.append(f"- [{platform}] {topic}: {description}")
    else:
        lines.append("- (none available)")
    lines.append("")

    # Inbox
    lines.append("MESSAGES FROM JAIVIEN (personal ideas/stories he wants to explore):")
    if context["inbox"]:
        for m in context["inbox"]:
            content_text = m.get("content") or m.get("message") or m.get("text") or str(m)
            lines.append(f"- {content_text}")
    else:
        lines.append("- (no messages today)")
    lines.append("")

    # Hooks
    lines.append("HOOK LIBRARY (use these formulas, adapt them):")
    if context["hooks"]:
        # Group by category if available
        by_category: dict[str, list] = {}
        for h in context["hooks"]:
            cat = h.get("category") or h.get("type") or "General"
            hook_text = h.get("hook") or h.get("text") or h.get("content") or str(h)
            by_category.setdefault(cat, []).append(hook_text)
        for cat, hook_list in by_category.items():
            lines.append(f"  [{cat}]")
            for hook_text in hook_list:
                lines.append(f"  - {hook_text}")
    else:
        lines.append("- (no hooks in library)")
    lines.append("")

    # Existing ideas
    lines.append("EXISTING IDEAS (avoid duplicating these):")
    if context["existing_ideas"]:
        for idea in context["existing_ideas"]:
            title = idea.get("title") or idea.get("name") or "(untitled)"
            lines.append(f"- {title}")
    else:
        lines.append("- (none yet)")
    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(
        f"Generate {count} complete content ideas for Jaivien. For each idea:"
    )
    lines.append("")
    lines.append(
        "1. Choose the most compelling angle — trending topic OR personal story "
        "(prefer personal when inbox has messages)"
    )
    lines.append(
        "2. Write a hook (first 3 seconds, max 15 words, must make someone stop scrolling)"
    )
    lines.append(
        "3. Write a complete script (60-90 seconds when spoken at normal pace, ~150-200 words)"
    )
    lines.append(
        "   - Structure: Hook → Personal context (5 sec) → Main value/story → Lesson → CTA"
    )
    lines.append(
        "   - Write it exactly how Jaivien would say it. Conversational. First person. Real."
    )
    lines.append(
        "4. Write the personal angle (1-2 sentences: how does this connect to Jaivien's actual journey?)"
    )
    lines.append(
        '5. Suggest platforms: array of ["tiktok", "instagram"] or add "youtube" if it warrants '
        'long-form, "linkedin" if it\'s more professional'
    )
    lines.append("")
    lines.append(f"Return a JSON array of exactly {count} objects:")
    lines.append(
        """[
  {
    "title": "short descriptive title",
    "hook": "the opening hook line",
    "script": "full script text",
    "personal_angle": "how this connects to Jaivien's real story",
    "platforms": ["tiktok", "instagram"],
    "content_type": "reel",
    "source": "thoth",
    "thoth_notes": "brief note on why this angle will perform"
  }
]"""
    )
    lines.append("")
    lines.append("Only return the JSON array. No other text.")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Step 3: Call Claude
# ---------------------------------------------------------------------------


def parse_claude_json(raw: str) -> list[dict] | None:
    """Extract JSON array from Claude's response text."""
    text = raw.strip()
    # Try direct parse first
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # Try extracting array between first [ and last ]
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            result = json.loads(match.group(0))
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    # Try extracting from markdown code block
    code_match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if code_match:
        try:
            result = json.loads(code_match.group(1))
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    return None


def call_claude(user_message: str, retry: bool = False) -> list[dict]:
    if not ANTHROPIC_API_KEY:
        log.error(
            "ANTHROPIC_API_KEY is not set. "
            "Set it in your environment or in ~/job-automation/.env"
        )
        sys.exit(1)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    messages = [{"role": "user", "content": user_message}]
    if retry:
        messages.append(
            {
                "role": "assistant",
                "content": "I'll return only the JSON array with no other text.",
            }
        )
        messages.append(
            {
                "role": "user",
                "content": (
                    "Please return only valid JSON. "
                    "No preamble, no explanation, no markdown — "
                    "just the raw JSON array starting with [ and ending with ]."
                ),
            }
        )

    log.info(f"Calling Claude ({CLAUDE_MODEL}){'  [retry]' if retry else ''}...")
    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
    except anthropic.APIError as exc:
        log.error(f"Claude API error: {exc}")
        sys.exit(1)

    raw = response.content[0].text if response.content else ""
    log.info(f"Claude response received ({len(raw)} chars)")

    ideas = parse_claude_json(raw)
    if ideas is None:
        if not retry:
            log.warning("Claude returned invalid JSON. Retrying once...")
            return call_claude(user_message, retry=True)
        else:
            log.error("Claude returned invalid JSON on retry. Raw response:")
            log.error(raw[:500])
            sys.exit(1)

    return ideas


# ---------------------------------------------------------------------------
# Step 4: POST ideas, PATCH inbox + trends
# ---------------------------------------------------------------------------


def post_ideas(ideas: list[dict], context: dict, dry_run: bool) -> tuple[int, int, int]:
    """
    POST ideas to Mission Control.
    PATCH inbox messages and trends that were used.
    Returns (posted_count, inbox_processed, trends_marked).
    """
    posted = 0
    inbox_processed = 0
    trends_marked = 0

    # Determine which inbox messages and trends to mark
    # We mark all pending inbox messages as picked_up and all undeveloped trends as developed
    # since Claude had access to all of them when generating ideas
    inbox_ids = [get_id(m) for m in context["inbox"] if get_id(m)]
    trend_ids = [get_id(t) for t in context["trends"] if get_id(t)]

    # POST each idea
    for idea in ideas:
        payload = {**idea, "status": "scripted"}
        if mc_post("/api/content", payload, dry_run=dry_run):
            posted += 1
            log.info(f"Posted idea: {idea.get('title', '(untitled)')!r}")
        else:
            log.warning(f"Failed to post idea: {idea.get('title', '(untitled)')!r}")

    # PATCH inbox items
    for inbox_id in inbox_ids:
        path = f"/api/content/inbox/{inbox_id}"
        if mc_patch(path, {"status": "picked_up"}, dry_run=dry_run):
            inbox_processed += 1
        else:
            log.warning(f"Failed to PATCH inbox item {inbox_id}")

    # PATCH trends
    for trend_id in trend_ids:
        path = f"/api/content/trends/{trend_id}"
        if mc_patch(path, {"developed": True}, dry_run=dry_run):
            trends_marked += 1
        else:
            log.warning(f"Failed to PATCH trend {trend_id}")

    return posted, inbox_processed, trends_marked


# ---------------------------------------------------------------------------
# Step 5: Write to Obsidian
# ---------------------------------------------------------------------------


def write_obsidian(ideas: list[dict], context: dict):
    today = datetime.now().strftime("%Y-%m-%d")
    vault_path = OBSIDIAN_VAULT_BASE / f"daily-content-{today}.md"

    if not OBSIDIAN_VAULT_BASE.exists():
        log.info(f"Obsidian vault path not found ({OBSIDIAN_VAULT_BASE}), skipping.")
        return

    lines = [
        f"# Daily Content Brief — {today}",
        "",
        f"Generated by Thoth at {datetime.now().strftime('%H:%M:%S')}",
        "",
        "---",
        "",
        "## Ideas Generated",
        "",
    ]

    for i, idea in enumerate(ideas, 1):
        title = idea.get("title", "(untitled)")
        hook = idea.get("hook", "")
        platforms = ", ".join(idea.get("platforms") or [])
        thoth_notes = idea.get("thoth_notes", "")
        lines.append(f"### {i}. {title}")
        lines.append(f"**Hook:** {hook}")
        lines.append(f"**Platforms:** {platforms}")
        if thoth_notes:
            lines.append(f"**Thoth notes:** {thoth_notes}")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Inbox Messages Processed")
    lines.append("")
    if context["inbox"]:
        for m in context["inbox"]:
            text = m.get("content") or m.get("message") or m.get("text") or str(m)
            lines.append(f"- {text}")
    else:
        lines.append("- (none)")
    lines.append("")
    lines.append("---")
    lines.append("")

    content = "\n".join(lines)

    try:
        # Append if file exists, create if not
        mode = "a" if vault_path.exists() else "w"
        with open(vault_path, mode, encoding="utf-8") as f:
            f.write(content)
        log.info(f"Wrote Obsidian daily summary to {vault_path}")
    except Exception as exc:
        log.warning(f"Could not write Obsidian file: {exc}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Generate content ideas via Claude and POST to Mission Control."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run everything but do not POST/PATCH Mission Control. Prints what would be sent.",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=5,
        metavar="N",
        help="Number of ideas to generate (default: 5).",
    )
    args = parser.parse_args()

    if args.dry_run:
        log.info("=== DRY-RUN MODE: no data will be written to Mission Control ===")

    log.info(f"Starting content ideator (generating {args.count} ideas)...")

    # Step 1
    context = gather_context()

    # Step 2
    log.info("Step 2: Building Claude prompt...")
    user_message = build_user_message(context, count=args.count)
    log.info(f"  Prompt length: {len(user_message)} chars")

    # Step 3
    log.info("Step 3: Calling Claude for ideas...")
    ideas = call_claude(user_message)
    log.info(f"  Claude returned {len(ideas)} ideas")

    if args.dry_run:
        log.info("[DRY-RUN] Ideas that would be posted:")
        for i, idea in enumerate(ideas, 1):
            print(f"\n--- Idea {i} ---")
            print(f"Title:          {idea.get('title', '')}")
            print(f"Hook:           {idea.get('hook', '')}")
            print(f"Platforms:      {', '.join(idea.get('platforms') or [])}")
            print(f"Personal angle: {idea.get('personal_angle', '')}")
            print(f"Thoth notes:    {idea.get('thoth_notes', '')}")
            print(f"Script preview: {idea.get('script', '')[:120]}...")

    # Step 4
    log.info("Step 4: Posting ideas and updating Mission Control...")
    posted, inbox_processed, trends_marked = post_ideas(ideas, context, dry_run=args.dry_run)

    # Step 5
    log.info("Step 5: Writing Obsidian daily summary...")
    write_obsidian(ideas, context)

    # Final summary
    print(
        f"\nGenerated {len(ideas)} ideas → posted to Mission Control. "
        f"Inbox: {inbox_processed} messages processed. "
        f"Trends: {trends_marked} marked developed."
    )
    log.info("Content ideator complete.")


if __name__ == "__main__":
    main()

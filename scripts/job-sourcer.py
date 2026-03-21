#!/usr/bin/env python3
"""
job-sourcer.py — Athena-side script to find, score, and shortlist jobs.

Runs on a cron to search for relevant positions, score them with Claude,
and POST them to Mission Control. High-scoring jobs (>= AUTO_APPROVE_THRESHOLD)
are set to 'approved' status so the applier picks them up immediately.

Usage:
  python3 job-sourcer.py                   # run once
  python3 job-sourcer.py --dry-run         # print what would be posted, don't send

Cron (every 4 hours):
  0 */4 * * * cd /path/to/scripts && python3 job-sourcer.py >> /var/log/job-sourcer.log 2>&1
"""

import os
import sys
import json
import time
import hashlib
import argparse
import requests
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────

MISSION_CONTROL_URL   = "https://mission-control-app-theta.vercel.app"
SHORTLIST_ENDPOINT    = f"{MISSION_CONTROL_URL}/api/jobs/shortlist"
HEARTBEAT_ENDPOINT    = f"{MISSION_CONTROL_URL}/api/council/heartbeat"
ANTHROPIC_API_KEY     = os.environ.get("ANTHROPIC_API_KEY", "")

# Jobs scoring above this threshold skip the review queue → go straight to apply queue
AUTO_APPROVE_THRESHOLD = 80  # 0-100

# What kind of roles to look for (Athena uses these as search terms)
JOB_SEARCH_QUERIES = [
    "senior software engineer remote",
    "full stack developer remote",
    "backend engineer python remote",
    "AI engineer LLM remote",
]

# Sources to search (implement whichever are available)
# Currently using Adzuna API (free tier) — set ADZUNA_APP_ID + ADZUNA_APP_KEY env vars
# Falls back to a stub list if no API key is set.
ADZUNA_APP_ID  = os.environ.get("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.environ.get("ADZUNA_APP_KEY", "")
ADZUNA_COUNTRY = os.environ.get("ADZUNA_COUNTRY", "us")

# ── Seen-jobs dedup ───────────────────────────────────────────────────────────

SEEN_FILE = os.path.join(os.path.dirname(__file__), ".job-sourcer-seen.json")

def load_seen() -> set:
    try:
        with open(SEEN_FILE) as f:
            return set(json.load(f))
    except FileNotFoundError:
        return set()

def save_seen(seen: set):
    with open(SEEN_FILE, "w") as f:
        json.dump(list(seen), f)

def job_fingerprint(job: dict) -> str:
    key = f"{job.get('company_name','').lower()}{job.get('job_title','').lower()}"
    return hashlib.md5(key.encode()).hexdigest()

# ── Job search ────────────────────────────────────────────────────────────────

def search_adzuna(query: str, max_results: int = 10) -> list[dict]:
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        return []
    try:
        url = f"https://api.adzuna.com/v1/api/jobs/{ADZUNA_COUNTRY}/search/1"
        params = {
            "app_id": ADZUNA_APP_ID,
            "app_key": ADZUNA_APP_KEY,
            "results_per_page": max_results,
            "what": query,
            "content-type": "application/json",
        }
        res = requests.get(url, params=params, timeout=15)
        res.raise_for_status()
        data = res.json()
        jobs = []
        for item in data.get("results", []):
            jobs.append({
                "job_title":    item.get("title", ""),
                "company_name": item.get("company", {}).get("display_name", ""),
                "location":     item.get("location", {}).get("display_name", ""),
                "salary_range": _format_salary(item),
                "description":  item.get("description", "")[:2000],
                "job_url":      item.get("redirect_url", ""),
            })
        return jobs
    except Exception as e:
        print(f"  [Adzuna] Error: {e}")
        return []

def _format_salary(item: dict) -> str:
    lo = item.get("salary_min")
    hi = item.get("salary_max")
    if lo and hi:
        return f"${int(lo):,} – ${int(hi):,}"
    if lo:
        return f"${int(lo):,}+"
    return ""

def fetch_all_jobs() -> list[dict]:
    jobs = []
    for query in JOB_SEARCH_QUERIES:
        print(f"  Searching: {query}")
        found = search_adzuna(query)
        jobs.extend(found)
        time.sleep(0.5)
    # Deduplicate within this batch by URL
    seen_urls = set()
    unique = []
    for j in jobs:
        url = j.get("job_url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique.append(j)
    return unique

# ── Scoring with Claude ───────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Hermes, Jai's job-scoring agent. Score software engineering jobs on a 0–100 scale.

Jai is a software engineer focused on:
- Full-stack web (Next.js, React, TypeScript, Python)
- AI/LLM integrations and automation
- Remote-first roles preferred
- Minimum $120k salary, ideally $150k+
- Avoids: enterprise Java shops, on-site only, contract-only with no path to perm

Return ONLY valid JSON with keys: score (int 0-100), rationale (1-2 sentences), cover_note (2-3 sentence opener for a cover letter).
"""

def score_job_with_claude(job: dict) -> dict:
    if not ANTHROPIC_API_KEY:
        print("  [Claude] No ANTHROPIC_API_KEY — using default score 50")
        return {"score": 50, "rationale": "Not scored (no API key)", "cover_note": ""}

    prompt = f"""Score this job:

Title: {job['job_title']}
Company: {job['company_name']}
Location: {job['location']}
Salary: {job.get('salary_range', 'not listed')}
Description: {job.get('description', '')[:1500]}
"""
    try:
        res = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 300,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        res.raise_for_status()
        text = res.json()["content"][0]["text"].strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        print(f"  [Claude] Scoring error: {e}")
        return {"score": 50, "rationale": "Scoring failed", "cover_note": ""}

# ── Post to Mission Control ───────────────────────────────────────────────────

def post_to_shortlist(job: dict, score_data: dict, dry_run: bool = False) -> bool:
    status = "approved" if score_data["score"] >= AUTO_APPROVE_THRESHOLD else "new"
    payload = {
        "job_title":    job["job_title"],
        "company_name": job["company_name"],
        "location":     job.get("location", ""),
        "salary_range": job.get("salary_range", ""),
        "description":  job.get("description", ""),
        "job_url":      job.get("job_url", ""),
        "my_assessment": f"[Score {score_data['score']}/100] {score_data['rationale']}",
        "skills_to_learn": "",
        "status":       status,
        "cover_note":   score_data.get("cover_note", ""),
    }

    if dry_run:
        print(f"  [DRY RUN] Would post: {job['job_title']} @ {job['company_name']} (score={score_data['score']}, status={status})")
        return True

    try:
        res = requests.post(SHORTLIST_ENDPOINT, json=payload, timeout=15)
        res.raise_for_status()
        print(f"  ✓ Posted: {job['job_title']} @ {job['company_name']} (score={score_data['score']}, status={status})")
        return True
    except Exception as e:
        print(f"  ✗ Failed to post {job['job_title']}: {e}")
        return False

def send_heartbeat(task: str):
    try:
        requests.post(HEARTBEAT_ENDPOINT, json={
            "agent_id": "athena",
            "agent_name": "Athena",
            "role": "Operations Manager",
            "color": "#06b6d4",
            "current_task": task,
            "task_type": "research",
            "status": "active",
        }, timeout=5)
    except Exception:
        pass

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print results without posting")
    parser.add_argument("--min-score", type=int, default=60, help="Minimum score to post (default 60)")
    args = parser.parse_args()

    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Job Sourcer starting...")
    send_heartbeat("Sourcing new job listings")

    seen = load_seen()
    print(f"  Already seen: {len(seen)} jobs")

    print("\nFetching jobs...")
    all_jobs = fetch_all_jobs()
    print(f"  Found {len(all_jobs)} raw listings")

    new_jobs = [j for j in all_jobs if job_fingerprint(j) not in seen]
    print(f"  {len(new_jobs)} new (not previously seen)")

    posted = 0
    for job in new_jobs:
        fp = job_fingerprint(job)
        print(f"\n  Scoring: {job['job_title']} @ {job['company_name']}")
        score_data = score_job_with_claude(job)
        score = score_data.get("score", 0)
        print(f"    Score: {score}/100 — {score_data.get('rationale', '')}")

        seen.add(fp)  # mark seen regardless of score

        if score < args.min_score:
            print(f"    Skipping (score {score} < threshold {args.min_score})")
            continue

        if post_to_shortlist(job, score_data, dry_run=args.dry_run):
            posted += 1

        time.sleep(0.3)  # gentle rate limit

    save_seen(seen)

    print(f"\n[Done] Posted {posted} new jobs. Total seen: {len(seen)}")
    send_heartbeat("Idle")

if __name__ == "__main__":
    main()

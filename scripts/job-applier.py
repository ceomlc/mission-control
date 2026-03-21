#!/usr/bin/env python3
"""
job-applier.py — Athena-side script to apply to queued jobs.

Polls Mission Control for jobs in 'approved' status, attempts to apply,
and reports back so the status moves to 'applied'.

Currently: logs the URL and marks as applied (manual form fill not yet automated).
Future: plug in browser automation (Playwright) to actually submit forms.

Usage:
  python3 job-applier.py          # process all queued jobs once
  python3 job-applier.py --daemon # loop every 15 minutes

Cron (every 30 min):
  */30 * * * * cd /path/to/scripts && python3 job-applier.py >> /var/log/job-applier.log 2>&1
"""

import os
import sys
import json
import time
import argparse
import requests
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────

MISSION_CONTROL_URL = "https://mission-control-app-theta.vercel.app"
APPLY_QUEUE_URL     = f"{MISSION_CONTROL_URL}/api/jobs/trigger-apply"
HEARTBEAT_URL       = f"{MISSION_CONTROL_URL}/api/council/heartbeat"
ANTHROPIC_API_KEY   = os.environ.get("ANTHROPIC_API_KEY", "")

# Set to True once you have browser automation set up.
# When False: logs the job URL to a file for manual application, marks as applied.
BROWSER_AUTOMATION_ENABLED = False

APPLY_LOG_FILE = os.path.join(os.path.dirname(__file__), "apply-queue.log")

# ── Cover letter generation ───────────────────────────────────────────────────

COVER_SYSTEM = """You are writing a short, direct cover letter opener for Jai Vien Kendrick, a software engineer.
Write 3 sentences max. Tone: confident, specific, not generic. No "I am writing to express my interest" openings.
Return only the cover letter text, no subject line, no sign-off."""

def generate_cover_letter(job: dict) -> str:
    cover_note = job.get("cover_note", "")
    if cover_note:
        return cover_note  # Already generated during scoring

    if not ANTHROPIC_API_KEY:
        return f"I'd love to join {job.get('company_name','your team')} as {job.get('job_title','an engineer')}."

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
                "max_tokens": 200,
                "system": COVER_SYSTEM,
                "messages": [{
                    "role": "user",
                    "content": f"Job: {job.get('job_title')} at {job.get('company_name')}. Assessment: {job.get('my_assessment', '')}",
                }],
            },
            timeout=20,
        )
        res.raise_for_status()
        return res.json()["content"][0]["text"].strip()
    except Exception as e:
        print(f"  [Claude] Cover letter error: {e}")
        return ""

# ── Application attempts ──────────────────────────────────────────────────────

def apply_with_browser(job: dict, cover_letter: str) -> tuple[bool, str]:
    """
    Placeholder for Playwright/Selenium automation.
    Implement this when browser automation is ready.
    """
    # TODO: integrate playwright
    # from playwright.sync_api import sync_playwright
    # with sync_playwright() as p:
    #     browser = p.chromium.launch(headless=False)
    #     page = browser.new_page()
    #     page.goto(job["job_url"])
    #     # ... fill form ...
    raise NotImplementedError("Browser automation not yet implemented")

def apply_to_job(job: dict) -> tuple[bool, str]:
    """
    Attempt to apply. Returns (success: bool, notes: str).
    """
    job_url = job.get("job_url", "")
    cover   = generate_cover_letter(job)

    if BROWSER_AUTOMATION_ENABLED:
        try:
            return apply_with_browser(job, cover)
        except NotImplementedError:
            pass
        except Exception as e:
            return False, f"Browser automation failed: {e}"

    # Fallback: log the URL for manual application, mark as applied
    # This lets Athena track it and you can check the log for follow-up
    log_entry = {
        "timestamp":  datetime.now().isoformat(),
        "job_id":     job.get("id"),
        "job_title":  job.get("job_title"),
        "company":    job.get("company_name"),
        "url":        job_url,
        "cover_note": cover,
        "status":     "logged_for_manual_apply",
    }
    with open(APPLY_LOG_FILE, "a") as f:
        f.write(json.dumps(log_entry) + "\n")

    print(f"  📋 Logged to apply-queue.log — URL: {job_url}")
    return True, f"Logged for application. URL: {job_url}"

# ── Reporting back ────────────────────────────────────────────────────────────

def report_result(job_id: int, success: bool, notes: str):
    try:
        res = requests.post(APPLY_QUEUE_URL, json={
            "job_id":  job_id,
            "success": success,
            "notes":   notes,
        }, timeout=10)
        res.raise_for_status()
        print(f"  ✓ Reported back to Mission Control (job {job_id}: {'applied' if success else 'kept in queue'})")
    except Exception as e:
        print(f"  ✗ Failed to report back: {e}")

def send_heartbeat(task: str):
    try:
        requests.post(HEARTBEAT_URL, json={
            "agent_id":    "athena",
            "agent_name":  "Athena",
            "role":        "Operations Manager",
            "color":       "#06b6d4",
            "current_task": task,
            "task_type":   "research",
            "status":      "active",
        }, timeout=5)
    except Exception:
        pass

# ── Main ──────────────────────────────────────────────────────────────────────

def process_queue():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Checking apply queue...")

    try:
        res = requests.get(APPLY_QUEUE_URL, timeout=15)
        res.raise_for_status()
        data = res.json()
    except Exception as e:
        print(f"  ✗ Could not fetch queue: {e}")
        return

    queued = data.get("queued", [])
    print(f"  {len(queued)} job(s) in apply queue")

    if not queued:
        return

    send_heartbeat(f"Applying to {len(queued)} queued job(s)")

    for job in queued:
        jid   = job.get("id")
        title = job.get("job_title", "Unknown")
        co    = job.get("company_name", "Unknown")
        print(f"\n  Applying: {title} @ {co}")

        success, notes = apply_to_job(job)
        report_result(jid, success, notes)
        time.sleep(1)

    send_heartbeat("Idle")
    print(f"\n[Done] Processed {len(queued)} job(s)")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--daemon", action="store_true", help="Loop every 15 minutes")
    parser.add_argument("--interval", type=int, default=900, help="Daemon interval in seconds (default 900 = 15 min)")
    args = parser.parse_args()

    if args.daemon:
        print(f"Job Applier daemon starting (every {args.interval}s). Ctrl+C to stop.")
        try:
            while True:
                process_queue()
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nShutting down.")
    else:
        process_queue()

if __name__ == "__main__":
    main()

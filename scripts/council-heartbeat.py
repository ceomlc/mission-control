#!/usr/bin/env python3
"""
council-heartbeat.py — Run on Athena or Thoth to report live status to Mission Control Council tab.

Usage:
  python3 council-heartbeat.py --agent athena --task "Running outreach" --task-type research

Or in background mode (loops every 30s):
  python3 council-heartbeat.py --agent athena --daemon

Task types: coding, research, writing, planning, security, break, coffee, gaming, idle
"""

import argparse
import time
import requests
import json
import sys
import subprocess
from datetime import datetime

MISSION_CONTROL_URL = "https://mission-control-app-theta.vercel.app/api/council/heartbeat"

AGENT_CONFIGS = {
    "athena": {
        "agent_id": "athena",
        "agent_name": "Athena",
        "role": "Operations Manager",
        "color": "#06b6d4",
    },
    "thoth": {
        "agent_id": "thoth",
        "agent_name": "Thoth",
        "role": "Research & Lead Scout",
        "color": "#f59e0b",
    },
}


def send_heartbeat(agent_id: str, task: str, task_type: str = "idle", metadata: dict = None):
    config = AGENT_CONFIGS.get(agent_id)
    if not config:
        print(f"Unknown agent: {agent_id}. Use: {list(AGENT_CONFIGS.keys())}")
        sys.exit(1)

    payload = {
        **config,
        "current_task": task,
        "task_type": task_type,
        "status": "active" if task_type not in ("break", "coffee", "gaming", "idle") else "idle",
        "metadata": metadata or {},
    }

    try:
        res = requests.post(MISSION_CONTROL_URL, json=payload, timeout=10)
        res.raise_for_status()
        data = res.json()
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ {config['agent_name']} → '{task}' ({task_type})")
        return True
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✗ Heartbeat failed: {e}")
        return False


def send_offline(agent_id: str):
    config = AGENT_CONFIGS.get(agent_id)
    if not config:
        return
    try:
        requests.delete(MISSION_CONTROL_URL, json={"agent_id": agent_id}, timeout=5)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {config['agent_name']} went offline")
    except Exception:
        pass


def main():
    parser = argparse.ArgumentParser(description="Mission Control Council heartbeat reporter")
    parser.add_argument("--agent", required=True, choices=list(AGENT_CONFIGS.keys()),
                        help="Which agent is reporting (athena or thoth)")
    parser.add_argument("--task", default="Idle", help="Current task description")
    parser.add_argument("--task-type", default="idle",
                        choices=["coding", "research", "writing", "planning", "security", "break", "coffee", "gaming", "idle"],
                        help="Task category")
    parser.add_argument("--daemon", action="store_true",
                        help="Run in background, sending heartbeats every 30s")
    parser.add_argument("--interval", type=int, default=30,
                        help="Heartbeat interval in seconds (daemon mode only)")

    args = parser.parse_args()

    if args.daemon:
        print(f"Starting {args.agent} heartbeat daemon (every {args.interval}s). Ctrl+C to stop.")
        try:
            while True:
                send_heartbeat(args.agent, args.task, args.task_type)
                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nShutting down...")
            send_offline(args.agent)
    else:
        send_heartbeat(args.agent, args.task, args.task_type)


if __name__ == "__main__":
    main()

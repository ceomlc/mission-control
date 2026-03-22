# Content Pipeline — Setup & Operations

Two scripts power the autonomous content pipeline. They run on different machines with different jobs.

---

## Which Script Runs Where

| Script | Machine | Schedule | Job |
|---|---|---|---|
| `content-trend-scout.py` | **Athena** | Every 4 hours | Scrapes Google Trends + Reddit, POSTs new trending topics to Mission Control |
| `content-ideator.py` | **THOTH** | Every morning at 6am | Reads all context, calls Claude, generates complete ideas + scripts, writes them back |

---

## Crontab Lines

### Athena — Trend Scout (every 4 hours)

```
0 */4 * * * /usr/bin/python3 /path/to/mission-control/scripts/content-trend-scout.py >> /var/log/trend-scout.log 2>&1
```

### THOTH — Content Ideator (6am daily)

```
0 6 * * * /usr/bin/python3 /path/to/mission-control/scripts/content-ideator.py >> /var/log/content-ideator.log 2>&1
```

To edit your crontab, run `crontab -e` on each machine. Replace `/path/to/mission-control` with the actual repo path on that machine. Find the correct Python path with `which python3`.

---

## Environment Variables

### Required on THOTH (content-ideator.py)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — get it at console.anthropic.com |
| `MISSION_CONTROL_URL` | Base URL for Mission Control (defaults to `https://mission-control-app-theta.vercel.app`) |

### Optional on Athena (content-trend-scout.py)

| Variable | Description |
|---|---|
| `MISSION_CONTROL_URL` | Override if running against a local or staging instance |

### Setting env vars

**Option 1 — Shell profile** (export in `~/.zshrc` or `~/.bashrc`):
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export MISSION_CONTROL_URL="https://mission-control-app-theta.vercel.app"
```

**Option 2 — .env file** (content-ideator.py auto-loads this):

Create `~/job-automation/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
MISSION_CONTROL_URL=https://mission-control-app-theta.vercel.app
```

---

## pip Dependencies

Install on each machine before first run:

```bash
# Athena (trend scout)
pip install requests pytrends

# THOTH (ideator)
pip install requests anthropic
```

Both scripts check for missing packages at startup and will exit with a clear message if something isn't installed.

---

## Testing with --dry-run

Neither script writes anything to Mission Control in dry-run mode. Use this to verify everything works before deploying to cron.

### Test the trend scout (Athena):
```bash
python content-trend-scout.py --dry-run
```
Expected output: timestamped log lines showing trends found from Google Trends and Reddit, with a final summary line like:
```
Scouted 24 trends (18 new, 6 skipped as duplicates)
```

### Test the ideator (THOTH):
```bash
python content-ideator.py --dry-run
# Or generate a different number of ideas:
python content-ideator.py --dry-run --count 3
```
Expected output: timestamped log lines for each step, then a printed preview of each generated idea (title, hook, platforms, script preview), and a final summary line like:
```
Generated 5 ideas → posted to Mission Control. Inbox: 2 messages processed. Trends: 8 marked developed.
```

### Quick end-to-end test (no cron, run manually):
```bash
# On Athena — populate some trends first
python content-trend-scout.py

# On THOTH — generate ideas from those trends
python content-ideator.py --count 2
```

---

## Obsidian Integration (THOTH only)

If `~/obsidian-vault/Content/` exists on THOTH's machine, the ideator appends a daily summary file at:
```
~/obsidian-vault/Content/daily-content-YYYY-MM-DD.md
```

If that directory doesn't exist, it skips silently — no errors. To enable it, just make sure that folder is present.

---

## Troubleshooting

**Google Trends returns nothing** — pytrends can be rate-limited. The script waits 1-2 seconds between requests. If it keeps failing, try running manually a few hours later or check if the Google Trends API is blocking the IP.

**Reddit 429 errors** — Reddit's public API has rate limits. The script includes a 1-second delay between subreddits. If you're hitting limits, increase the delay in the `fetch_reddit_trends()` function.

**Claude returns invalid JSON** — The ideator retries once automatically with a stricter prompt. If it fails twice, check the raw Claude output in the logs.

**Mission Control 401/403 errors** — Check if the API requires authentication headers. Add them to the `HEADERS` dict at the top of each script if needed.

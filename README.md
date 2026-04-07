# Quranic Pomodoro

Quranic Pomodoro is an Arabic-first focus + Quran reading app.

## Current Architecture

- Main app: `new q/` (Next.js App Router)
- API routes: `new q/src/app/api/*`
- Reader state persistence: `state.json`

Legacy FastAPI backend has been removed from runtime flow.

## Project Layout

- `new q/`: Active application (frontend + route handlers)
- `download_quran.py`: Utility script to download Quran datasets
- `export_project_code.py`: Utility script to export workspace code snapshots
- `state.json`: Persists current rub pointer
- `start.bat`: Windows launcher for Next app only

## Requirements

- Node.js 22+
- npm

Optional Python utilities use `requirements.txt`.

## Setup

```bash
cd "new q"
npm install
```

## Run

From repository root (Windows):

```bat
start.bat
```

Or manually:

```bash
cd "new q"
npm run dev -- --hostname 127.0.0.1 --port 4000
```

## Tests

Run from `new q/`:

```bash
npm run test
npm run test:e2e
```

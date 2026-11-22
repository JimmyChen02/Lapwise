#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo 'Install Python 3.12+ first.'; exit 1; }
command -v npm >/dev/null || { echo 'Install Node.js 22+ first.'; exit 1; }
if [ ! -d .venv ]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install -r requirements.lock
npm --prefix frontend ci
npm --prefix frontend run build
echo "Lapwise is available at http://127.0.0.1:${PORT:-8000}"
exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8000}"

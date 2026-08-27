#!/usr/bin/env bash

# Runs friday-frontend and friday-extras-backend and uses the live deployed rCTF instance.

# Assumes that you have pulled the backend into the `../friday-extras-backend` dir
# (if that is not the case, override the BACKEND_DIR env var to point to it).

set -euo pipefail

WEB_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="${BACKEND_DIR:-$(dirname -- "$WEB_DIR")/friday-extras-backend}"
RCTF_ORIGIN="${RCTF_ORIGIN:-https://friday-platform.polygl0ts.ch}"
WEB_ORIGIN="http://localhost:5173"
API_ORIGIN="http://localhost:8091"

[ -d "$API_DIR/app" ] || { echo "no backend checkout at $API_DIR (set BACKEND_DIR)" >&2; exit 1; }
command -v uv >/dev/null || { echo "dev.sh needs uv (https://docs.astral.sh/uv/)" >&2; exit 1; }

# run the backend on the same python version as it is in prod so we don't have to deal
# with package issues
uv venv --quiet --allow-existing "$API_DIR/.venv" \
    --python "$(sed -n 's/^FROM python:\([0-9.]*\).*/\1/p' "$API_DIR/Dockerfile")"

# install deps for backend
VIRTUAL_ENV="$API_DIR/.venv" uv pip install --quiet -r "$API_DIR/requirements.txt"

# install deps for frontend
[ -d "$WEB_DIR/node_modules" ] || (cd "$WEB_DIR" && npm install)

mkdir -p "$API_DIR/data"

# run backend
(
    cd "$API_DIR"
    exec env \
        EXTRAS_RCTF_ORIGIN="$RCTF_ORIGIN" \
        EXTRAS_DATABASE_URL="sqlite:///./data/friday-extras-dev.db" \
        EXTRAS_CORS_ORIGINS="[\"$WEB_ORIGIN\"]" \
        EXTRAS_WEB_ORIGIN="$WEB_ORIGIN" \
        .venv/bin/uvicorn app.main:app --port 8091 --reload --reload-dir app
) > >(sed 's/^/api | /') 2>&1 &
api_pid=$!

# run frontend
(
    cd "$WEB_DIR"
    exec env DEV_RCTF_ORIGIN="$RCTF_ORIGIN" DEV_EXTRAS_ORIGIN="$API_ORIGIN" \
        node_modules/.bin/vite --port 5173 --strictPort
) > >(sed 's/^/web | /') 2>&1 &
web_pid=$!

# make sure Ctrl-C kills frontend & backend
trap 'kill "$api_pid" "$web_pid" 2>/dev/null' EXIT INT TERM

echo
echo "  frontend  $WEB_ORIGIN"
echo "  extras    $API_ORIGIN/docs"
echo "  rctf      $RCTF_ORIGIN (live)"
echo

# if either dies, kill both
wait -n "$api_pid" "$web_pid"

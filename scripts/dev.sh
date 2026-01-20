#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend..."
(cd "${BACKEND_DIR}" && python -m app.main) &
BACKEND_PID=$!

echo "Starting frontend..."
(cd "${FRONTEND_DIR}" && npm run dev) &
FRONTEND_PID=$!

wait "${BACKEND_PID}" "${FRONTEND_PID}"

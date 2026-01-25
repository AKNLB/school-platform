#!/usr/bin/env bash
set -euo pipefail

base="${1:-http://localhost}"

echo "== health =="
curl -fsS "$base/api/health" | python3 -m json.tool

echo "== health/db =="
curl -fsS "$base/api/health/db" | python3 -m json.tool

echo "== ping =="
curl -fsS "$base/api/ping" | python3 -m json.tool

echo "== tenant ping =="
curl -fsS "$base/api/s/abc-learning-centre/ping" | python3 -m json.tool

echo "✅ smoke OK"

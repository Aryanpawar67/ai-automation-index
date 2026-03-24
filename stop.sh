#!/bin/bash

PID_FILE=".pids"

echo ""
echo "Stopping AI Automation Index..."
echo "──────────────────────────────────"

# ── Kill tracked PIDs and their children ──────────────────────────────────────
if [ -f "$PID_FILE" ]; then
  while IFS= read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      # Kill child processes first (e.g. Next.js node worker spawned by npm)
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      echo "  Stopped PID $pid"
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
else
  echo "  No .pids file found — trying port-based cleanup."
fi

# ── Port-based cleanup (catches any orphans) ───────────────────────────────────
for PORT in 3003 8288; do
  PIDS=$(lsof -ti:"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    echo "  Freed port $PORT"
  fi
done

echo "  All services stopped."
echo "──────────────────────────────────"
echo ""

#!/bin/bash
set -e

PID_FILE=".pids"
LOG_DIR=".logs"

if [ -f "$PID_FILE" ]; then
  echo "Services already running. Run ./stop.sh first."
  exit 1
fi

mkdir -p "$LOG_DIR"

echo ""
echo "Starting AI Automation Index..."
echo "──────────────────────────────────"

# ── 1. Next.js dev server ──────────────────────────────────────────────────────
PORT=3003 npm run dev > "$LOG_DIR/nextjs.log" 2>&1 &
NEXT_PID=$!
echo $NEXT_PID >> "$PID_FILE"
echo "  Next.js   PID $NEXT_PID  →  starting on :3003 (see .logs/nextjs.log)"

# Give Next.js time to bind before Inngest tries to connect to /api/inngest
echo "  Waiting for Next.js to be ready..."
for i in $(seq 1 20); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/api/inngest 2>/dev/null | grep -qE "^(200|405|404)"; then
    break
  fi
  sleep 1
done

# ── 2. Inngest dev server ──────────────────────────────────────────────────────
npx inngest-cli@latest dev -u http://localhost:3003/api/inngest > "$LOG_DIR/inngest.log" 2>&1 &
INNGEST_PID=$!
echo $INNGEST_PID >> "$PID_FILE"
echo "  Inngest   PID $INNGEST_PID  →  http://localhost:8288 (see .logs/inngest.log)"

echo ""
echo "  App:      http://localhost:3003"
echo "  Admin:    http://localhost:3003/admin"
echo "  Inngest:  http://localhost:8288"
echo ""
echo "  Neon DB:  managed cloud — no local service needed"
echo ""
echo "  Run ./stop.sh to stop everything."
echo "──────────────────────────────────"

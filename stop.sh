#!/bin/bash

PID_FILE=".pids"

if [ ! -f "$PID_FILE" ]; then
  echo "No running services found."
  exit 1
fi

echo "Stopping AI Automation Index..."

while IFS= read -r pid; do
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "Stopped process (PID: $pid)"
  fi
done < "$PID_FILE"

rm -f "$PID_FILE"
echo "All services stopped."

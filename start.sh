#!/bin/bash

PID_FILE=".pids"

if [ -f "$PID_FILE" ]; then
  echo "Services already running. Use ./stop.sh first."
  exit 1
fi

echo "Starting AI Automation Index..."

npm run dev &
echo $! >> "$PID_FILE"

echo "Dev server started (PID: $!)"
echo "App available at http://localhost:3000"

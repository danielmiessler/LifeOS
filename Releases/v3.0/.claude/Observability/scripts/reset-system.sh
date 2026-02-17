#!/bin/bash
# Stop observability dashboard - silent operation

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Kill processes on ports (silent)
kill_port() {
    local port=$1
    if [[ "$OSTYPE" == "darwin"* ]]; then
        PIDS=$(lsof -ti :$port 2>/dev/null)
    else
        PIDS=$(lsof -ti :$port 2>/dev/null || fuser -n tcp $port 2>/dev/null | awk '{print $2}')
    fi

    if [ -n "$PIDS" ]; then
        for PID in $PIDS; do
            kill -9 $PID 2>/dev/null
        done
    fi
}

kill_port 4000
kill_port 5172

# Kill remaining bun processes (silent)
ps aux | grep -E "bun.*(apps/(server|client))" | grep -v grep | awk '{print $2}' | while read PID; do
    [ -n "$PID" ] && kill -9 $PID 2>/dev/null
done

# Clean SQLite WAL files (silent)
rm -f "$PROJECT_ROOT/apps/server/events.db-wal" "$PROJECT_ROOT/apps/server/events.db-shm" 2>/dev/null
#!/bin/bash
# Observability Dashboard Manager - Part of PAI infrastructure
# Location: $PAI_DIR/Observability/ (defaults to ~/.claude/Observability/)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure bun is in PATH (for apps launched from macOS)
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

case "${1:-}" in
    start)
        # Check if already running
        if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "❌ Already running. Use: manage.sh restart"
            exit 1
        fi

        # Start server (silent)
        cd "$SCRIPT_DIR/apps/server"
        bun run dev >/dev/null 2>&1 &
        SERVER_PID=$!

        # Wait for server
        for i in {1..10}; do
            curl -s http://localhost:4000/events/filter-options >/dev/null 2>&1 && break
            sleep 1
        done

        # Start client (silent)
        cd "$SCRIPT_DIR/apps/client"
        bun run dev >/dev/null 2>&1 &
        CLIENT_PID=$!

        # Wait for client
        for i in {1..10}; do
            curl -s http://localhost:5172 >/dev/null 2>&1 && break
            sleep 1
        done

        echo "✅ Observability running at http://localhost:5172"

        # Cleanup on exit
        cleanup() {
            kill $SERVER_PID $CLIENT_PID 2>/dev/null
            exit 0
        }
        trap cleanup INT
        wait $SERVER_PID $CLIENT_PID
        ;;

    stop)
        # Kill processes (silent)
        for port in 4000 5172; do
            if [[ "$OSTYPE" == "darwin"* ]]; then
                PIDS=$(lsof -ti :$port 2>/dev/null)
            else
                PIDS=$(lsof -ti :$port 2>/dev/null || fuser -n tcp $port 2>/dev/null | awk '{print $2}')
            fi
            [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null
        done

        # Kill remaining bun processes
        ps aux | grep -E "bun.*(apps/(server|client))" | grep -v grep | awk '{print $2}' | while read PID; do
            [ -n "$PID" ] && kill -9 $PID 2>/dev/null
        done

        # Clean SQLite WAL files
        rm -f "$SCRIPT_DIR/apps/server/events.db-wal" "$SCRIPT_DIR/apps/server/events.db-shm" 2>/dev/null

        echo "✅ Observability stopped"
        ;;

    restart)
        echo "🔄 Restarting..."
        "$0" stop 2>/dev/null
        sleep 1
        exec "$0" start
        ;;

    status)
        if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "✅ Running at http://localhost:5172"
        else
            echo "❌ Not running"
        fi
        ;;

    start-detached)
        # Check if already running
        if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "❌ Already running. Use: manage.sh restart"
            exit 1
        fi

        # Start server detached (for menu bar app use)
        cd "$SCRIPT_DIR/apps/server"
        nohup bun run dev >/dev/null 2>&1 &
        disown

        # Wait for server to be ready
        for i in {1..10}; do
            curl -s http://localhost:4000/events/filter-options >/dev/null 2>&1 && break
            sleep 1
        done

        # Start client detached
        cd "$SCRIPT_DIR/apps/client"
        nohup bun run dev >/dev/null 2>&1 &
        disown

        # Wait for client to be ready
        for i in {1..10}; do
            curl -s http://localhost:5172 >/dev/null 2>&1 && break
            sleep 1
        done

        echo "✅ Observability running at http://localhost:5172"
        ;;

    *)
        echo "Usage: manage.sh {start|stop|restart|status|start-detached}"
        exit 1
        ;;
esac

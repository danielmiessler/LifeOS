#!/bin/bash
# Start observability dashboard - minimal output

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
PAI_DIR="${PAI_DIR:-$HOME/.claude}"

# Check if ports are in use
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port 4000 in use. Run: $PAI_DIR/Observability/manage.sh stop"
    exit 1
fi

if lsof -Pi :5172 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port 5172 in use. Run: $PAI_DIR/Observability/manage.sh stop"
    exit 1
fi

# Start server (suppress verbose output)
cd "$PROJECT_ROOT/apps/server"
bun run dev >/dev/null 2>&1 &
SERVER_PID=$!

# Wait for server (silent)
for i in {1..10}; do
    curl -s http://localhost:4000/events/filter-options >/dev/null 2>&1 && break
    sleep 1
done

# Start client (suppress verbose output)
cd "$PROJECT_ROOT/apps/client"
bun run dev >/dev/null 2>&1 &
CLIENT_PID=$!

# Wait for client (silent)
for i in {1..10}; do
    curl -s http://localhost:5172 >/dev/null 2>&1 && break
    sleep 1
done

# Confirm startup
echo "✅ Observability Dashboard Running"
echo "   Dashboard: http://localhost:5172"
echo "   API: http://localhost:4000"

# Cleanup on exit
cleanup() {
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit 0
}

trap cleanup INT
wait $SERVER_PID $CLIENT_PID
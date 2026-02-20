#!/bin/bash
# Loads .env and launches an MCP server
# Usage: launch.sh <command> [args...]
set -a
source "$(dirname "$0")/.env"
set +a
exec "$@"

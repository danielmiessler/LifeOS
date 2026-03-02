#!/bin/bash
# Bug Bounty Tracker CLI wrapper

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$1" in
  init|initialize)
    bun run "$SCRIPT_DIR/src/init.ts"
    ;;

  update)
    bun run "$SCRIPT_DIR/src/update.ts"
    ;;

  show|list)
    shift
    bun run "$SCRIPT_DIR/src/show.ts" "$@"
    ;;

  search)
    shift
    bun run "$SCRIPT_DIR/src/show.ts" --search "$@"
    ;;

  recon|initiate-recon)
    shift
    bun run "$SCRIPT_DIR/src/recon.ts" "$@"
    ;;

  help|--help|-h)
    cat << EOF
Bug Bounty Tracker - Track new bug bounty programs automatically

USAGE:
  bounty.sh <command> [options]

COMMANDS:
  init              Initialize the tracker (first-time setup)
  update            Check for new programs and updates
  show [options]    Show recent discoveries
  search <query>    Search for programs by name/platform
  recon <number>    Initiate reconnaissance on program #
  help              Show this help message

SHOW OPTIONS:
  --last <time>     Show programs from last X time (e.g., 24h, 7d, 30d)
  --all             Show all cached programs
  --search <query>  Search by name or platform

EXAMPLES:
  bounty.sh init                    # First-time setup
  bounty.sh update                  # Check for new programs
  bounty.sh show                    # Show last 24 hours
  bounty.sh show --last 7d          # Show last 7 days
  bounty.sh show --all              # Show all programs
  bounty.sh search "stripe"         # Search for Stripe programs
  bounty.sh recon 1                 # Start recon on program #1

EOF
    ;;

  *)
    echo "Unknown command: $1"
    echo "Run 'bounty.sh help' for usage information"
    exit 1
    ;;
esac

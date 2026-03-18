# Bug Bounty Tracker CLI wrapper

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

switch ($args[0]) {
    { $_ -in "init", "initialize" } {
        bun run "$ScriptDir\src\init.ts"
    }

    "update" {
        bun run "$ScriptDir\src\update.ts"
    }

    { $_ -in "show", "list" } {
        $remaining = $args[1..($args.Length - 1)]
        bun run "$ScriptDir\src\show.ts" @remaining
    }

    "search" {
        $remaining = $args[1..($args.Length - 1)]
        bun run "$ScriptDir\src\show.ts" --search @remaining
    }

    { $_ -in "recon", "initiate-recon" } {
        $remaining = $args[1..($args.Length - 1)]
        bun run "$ScriptDir\src\recon.ts" @remaining
    }

    { $_ -in "help", "--help", "-h" } {
        @"
Bug Bounty Tracker - Track new bug bounty programs automatically

USAGE:
  bounty.ps1 <command> [options]

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
  bounty.ps1 init                    # First-time setup
  bounty.ps1 update                  # Check for new programs
  bounty.ps1 show                    # Show last 24 hours
  bounty.ps1 show --last 7d          # Show last 7 days
  bounty.ps1 show --all              # Show all programs
  bounty.ps1 search "stripe"         # Search for Stripe programs
  bounty.ps1 recon 1                 # Start recon on program #1
"@
    }

    default {
        Write-Host "Unknown command: $($args[0])"
        Write-Host "Run 'bounty.ps1 help' for usage information"
        exit 1
    }
}

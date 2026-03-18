# Build script for Observability menu bar app (Windows adaptation)
# Note: The original macOS build.sh creates a .app bundle using swiftc/lipo.
# This Windows equivalent builds a .NET WPF system tray application instead.

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppName = "Observability"
$BuildDir = Join-Path $ScriptDir "build"
$InstallPath = Join-Path $env:LOCALAPPDATA $AppName

Write-Host "Building $AppName..."

# Clean previous build
if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}

# Create build directory
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

# Check for dotnet CLI
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Host "Error: .NET SDK not found. Install from https://dotnet.microsoft.com/download"
    exit 1
}

# Build the application (assumes a .csproj exists)
$ProjectFile = Join-Path $ScriptDir "$AppName.csproj"
if (Test-Path $ProjectFile) {
    dotnet publish $ProjectFile -c Release -o $BuildDir --self-contained false
} else {
    Write-Host "Warning: No .csproj found. Skipping compilation."
    Write-Host "To build, create a .NET project for the system tray application."
}

Write-Host "Build complete: $BuildDir"

# Optionally install to user's local app directory
$Reply = Read-Host "Install to $InstallPath ? [y/N]"
if ($Reply -match '^[Yy]$') {
    Write-Host "Installing to $InstallPath..."
    if (Test-Path $InstallPath) {
        Remove-Item -Recurse -Force $InstallPath
    }
    Copy-Item -Recurse $BuildDir $InstallPath
    Write-Host "Installed to $InstallPath"
    Write-Host ""
    Write-Host "To start the app: & `"$InstallPath\$AppName.exe`""
    Write-Host "To enable launch at login: Use the system tray icon -> 'Launch at Login'"
}

# PAI Installer v3.0 — Entry Point (Windows PowerShell)
# Forwards to the full installer in PAI-Install\
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
& powershell -ExecutionPolicy Bypass -File (Join-Path $SCRIPT_DIR "PAI-Install\install.ps1") @args

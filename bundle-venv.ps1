# PowerShell script to bundle Python virtual environment with Electron app
# Usage: Run this script after building your Electron app

$venvPath = Join-Path $PSScriptRoot ".venv"
$buildOutput = Join-Path $PSScriptRoot "dist\win-unpacked"
$targetVenv = Join-Path $buildOutput ".venv"

if (!(Test-Path $venvPath)) {
    Write-Error ".venv not found in project root. Please create and install dependencies first."
    exit 1
}

if (!(Test-Path $buildOutput)) {
    Write-Error "Build output directory not found: $buildOutput"
    exit 1
}

Write-Host "Copying .venv to build output..."
Copy-Item $venvPath $targetVenv -Recurse -Force
Write-Host ".venv successfully bundled to $targetVenv"

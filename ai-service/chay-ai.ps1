# Chay tai thu muc ai-service bang PowerShell: .\chay-ai.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path '.\.venv\Scripts\python.exe')) {
    py -3 -m venv .venv
}
& '.\.venv\Scripts\python.exe' -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Khong cai duoc thu vien Python' }
& '.\.venv\Scripts\python.exe' -m uvicorn main:app --host 127.0.0.1 --port 8008

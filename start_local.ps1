<#
.SYNOPSIS
Inicia o backend (FastAPI) e o frontend (Vite) do PyPlanPoker localmente.
#>

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando PyPlanPoker..." -ForegroundColor Cyan

# Caminhos
$baseDir = $PSScriptRoot
$backendDir = Join-Path $baseDir "backend"
$frontendDir = Join-Path $baseDir "frontend"

# Iniciar o Backend
Write-Host "Iniciando Backend na porta 5000..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; if (Test-Path 'venv\Scripts\activate.ps1') { .\venv\Scripts\activate.ps1 } else { Write-Host 'VENV não encontrado! Crie com: python -m venv venv' -ForegroundColor Red }; python -m app.main" -PassThru

# Iniciar o Frontend
Write-Host "Iniciando Frontend na porta 3000..." -ForegroundColor Yellow
$frontendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run start" -PassThru

Write-Host "✅ Serviços iniciados em janelas separadas!" -ForegroundColor Green
Write-Host "Backend: http://localhost:5000"
Write-Host "Frontend: http://localhost:3000"
Write-Host "Para fechar, basta fechar as janelas que foram abertas." -ForegroundColor DarkGray

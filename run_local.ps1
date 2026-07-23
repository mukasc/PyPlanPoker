Write-Host "Iniciando o PyPlanPoker localmente..." -ForegroundColor Green

# Iniciar o Backend em uma nova janela
Write-Host "Iniciando o Backend (FastAPI)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\activate; uvicorn server:app --reload --port 5000"

# Iniciar o Frontend em uma nova janela
Write-Host "Iniciando o Frontend (React/Vite)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run start"

Write-Host "Ambos os serviços foram iniciados em janelas separadas!" -ForegroundColor Green

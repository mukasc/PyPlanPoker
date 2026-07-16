#!/bin/bash

echo "🚀 Iniciando PyPlanPoker..."

# Cores para o output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Iniciar o Backend em background
echo -e "${YELLOW}Iniciando Backend na porta 5000...${NC}"
(
  cd backend || exit
  if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
  else
    echo -e "VENV não encontrado! Crie com: python -m venv venv"
  fi
  python -m app.main
) &
BACKEND_PID=$!

# Iniciar o Frontend em background
echo -e "${YELLOW}Iniciando Frontend na porta 3000...${NC}"
(
  cd frontend || exit
  npm run start
) &
FRONTEND_PID=$!

echo -e "${GREEN}✅ Serviços iniciados!${NC}"
echo -e "${CYAN}Backend PID: ${BACKEND_PID}${NC} - http://localhost:5000"
echo -e "${CYAN}Frontend PID: ${FRONTEND_PID}${NC} - http://localhost:3000"
echo -e "${YELLOW}Pressione CTRL+C para encerrar os servidores.${NC}"

# Função para encerrar os processos ao apertar CTRL+C
cleanup() {
    echo -e "\n${YELLOW}Encerrando servidores...${NC}"
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit 0
}

trap cleanup SIGINT SIGTERM

# Esperar para sempre (até que o usuário aperte CTRL+C)
wait

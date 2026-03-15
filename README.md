# 🃏 PyPlanPoker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react)](https://reactjs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socket.io)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=flat&logo=mongodb)](https://www.mongodb.com/)

**PyPlanPoker** é uma ferramenta de Planning Poker colaborativa em tempo real, projetada para ajudar equipes ágeis a estimar tarefas de forma eficiente e divertida.

---

## 🚀 Funcionalidades

- **🔥 Tempo Real:** Sincronização instantânea entre todos os participantes usando WebSockets.
- **🗳️ Votações Flexíveis:** Suporte para decks Fibonacci, Sequencial, Camisetas (T-Shirt) e Decks Customizados.
- **📋 Gestão de Tarefas:** Adicione, edite, reordene (drag-and-drop) e gerencie o backlog da sala.
- **🕒 Timer de Discussão:** Cronômetro integrado para manter as discussões focadas.
- **🔐 Autenticação Segura:** Login via Google OAuth ou acesso rápido como Convidado (Guest).
- **👑 Controle Administrativo:** Donos de sala podem revelar cartas, resetar votos e gerenciar participantes.
- **📊 Histórico de Votos:** Veja quem votou em quê após a revelação das cartas.
- **🎨 Design Moderno:** Interface responsiva construída com Tailwind CSS e componentes Radix UI.

---

## 🛠️ Stack Tecnológica

### Backend
- **Python 3.10+**
- **FastAPI:** Framework web de alta performance.
- **Socket.io:** Comunicação bidirecional em tempo real.
- **Motor (MongoDB):** Driver assíncrono para persistência de dados.
- **JWT (python-jose):** Autenticação baseada em tokens.
- **Slowapi:** Rate limiting para proteção das rotas.

### Frontend
- **React 19**
- **Vite:** Build tool ultra-rápida.
- **Tailwind CSS:** Estilização utilitária.
- **Zustand:** Gerenciamento de estado global simples e performático.
- **Shadcn/UI & Radix UI:** Componentes de UI acessíveis e elegantes.
- **dnd-kit:** Suporte para drag-and-drop na reordenação de tarefas.

---

## ⚙️ Configuração Local

### Pré-requisitos
- Python instalado.
- Node.js instalado.
- Instância do MongoDB (local ou Atlas).

### 1. Clonar o Repositório
```bash
git clone https://github.com/mukasc/PyPlanPoker.git
cd PyPlanPoker
```

### 2. Backend Setup
Navegue para a pasta `backend`, crie um ambiente virtual e instale as dependências:
```bash
cd backend
python -m venv venv
source venv/bin/scripts/activate  # No Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### Variáveis de Ambiente (.env)
Crie um arquivo `.env` na pasta `backend`:
```env
MONGO_URL=your_mongodb_connection_string
DB_NAME=pyplanpoker
JWT_SECRET=your_super_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
ALLOWED_ORIGINS=http://localhost:3000
```

#### Rodar o Servidor
```bash
python server.py
```

### 3. Frontend Setup
Navegue para a pasta `frontend` e instale as dependências:
```bash
cd frontend
npm install
```

#### Variáveis de Ambiente (.env)
Crie um arquivo `.env` na pasta `frontend`:
```env
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

#### Rodar o Servidor de Desenvolvimento
```bash
npm run start
```
O app estará disponível em `http://localhost:3000`.

---

## 📂 Estrutura do Projeto

```text
PyPlanPoker/
├── backend/            # FastAPI Server, Sockets e Lógica de DB
│   ├── server.py       # Ponto de entrada principal
│   └── requirements.txt
├── frontend/           # Aplicação React
│   ├── src/
│   │   ├── components/ # Componentes reutilizáveis
│   │   ├── pages/      # Páginas (Home, Room)
│   │   └── store/      # Estado com Zustand
│   └── package.json
└── README.md
```

---

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).

---
*Desenvolvido com ❤️ para agilizar estimativas.*

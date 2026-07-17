import { io } from 'socket.io-client';

let socket;

export const connectSocket = () => {
  if (!socket) {
    // 1. URL do Backend (Vercel injeta VITE_API_URL, Local usa vazio)
    const apiUrl = import.meta.env.VITE_API_URL || '';

    // 2. O Path OBRIGATORIAMENTE tem que bater com o 'socketio_path' do server.py
    // No seu server.py está: socketio_path='/api/socket.io'
    const socketPath = '/api/socket.io/';

    console.log(`🔌 Tentando conectar Socket em: ${apiUrl || 'Localhost'} (Path: ${socketPath})`);

    socket = io(apiUrl, {
      path: socketPath, // Caminho fixo e correto
      transports: ['polling', 'websocket'], // Adicionei websocket para permitir upgrade (mais rápido)
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      autoConnect: true,
      withCredentials: true,
      auth: {
        token: localStorage.getItem('access_token') // Legacy fallback
      }
    });
    
    socket.on('connect_error', (err) => {
      console.error('❌ Socket Error:', err.message);
    });

    socket.on('connect', () => {
      console.log('✅ SOCKET CONECTADO! ID:', socket.id);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('⚠️ Socket desconectado:', reason);
    });
  }
  
  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null; // Boa prática limpar a variável
  }
};

export const getSocket = () => {
  if (!socket) return connectSocket();
  return socket;
};
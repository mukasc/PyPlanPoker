import { io } from 'socket.io-client';

let socket;

export const connectSocket = () => {
  if (!socket) {
    // Se existir variável de ambiente (Prod), usa ela. Se não, usa vazio (o Proxy do Vite resolve no Local)
    // Nota: O Vercel injeta as variáveis automaticamente no build.
    const apiUrl = import.meta.env.VITE_API_URL || '';
    
    // Se for produção (tem URL completa), usamos o path /socket.io/ normal
    // Se for dev (vazio), usamos /api/socket.io/ pro proxy pegar
    const path = apiUrl ? '/socket.io/' : '/api/socket.io/';

    console.log('🔌 Conectando Socket em:', apiUrl || 'Localhost Proxy');

    socket = io(apiUrl, {
      path: path,
      transports: ['polling'], // Mantém polling
      upgrade: true,
      reconnection: true,
      autoConnect: true,
    });
    
    socket.on('connect_error', (err) => {
      console.log('Socket Error:', err.message);
    });

    socket.on('connect', () => {
      console.log('✅ SOCKET CONECTADO VIA API PATH!');
    });
  }
  
  if (!socket.connected) {
    socket.connect();
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) socket.disconnect();
};

export const getSocket = () => {
  if (!socket) return connectSocket();
  return socket;
};
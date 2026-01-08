import { io } from 'socket.io-client';

let socket;

export const connectSocket = () => {
  if (!socket) {
    const baseUrl = window.location.origin;
    
    // --- MUDANÇA CRUCIAL AQUI ---
    // Alteramos o path para começar com /api, assim o Proxy deixa passar
    socket = io(baseUrl, {
      path: '/api/socket.io/', // <--- AGORA VAI PASSAR PELO PROXY
      transports: ['polling'],
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
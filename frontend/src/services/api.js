import axios from 'axios';

const api = axios.create({
  // Aqui está a mágica: Ele tenta pegar a variável do Render.
  // Se não achar (local), usa localhost.
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
});

export default api;
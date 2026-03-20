import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://pyplanpoker.onrender.com', // Prefer production URL default
});

// Adiciona o token JWT em todas as requisições se existir
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para lidar com o cold-start do Render
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Se for o check de saúde, não queremos poluir com o interceptor de erro global
    if (error.config && error.config._isHealthCheck) {
      return Promise.reject(error);
    }

    // Se o backend estiver fora (502/503/timeout), poderíamos disparar algo aqui
    // Mas o component BackendHealthCheck já cuida do boot inicial.
    return Promise.reject(error);
  }
);

export default api;
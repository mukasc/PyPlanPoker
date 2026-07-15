import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Room from "./pages/Room";
import Login from "./pages/Login";
import useAuthStore from "./store/authStore";
import useGameStore from "./store/gameStore";
import { useEffect } from "react";
import api from "./services/api";
import BackendHealthCheck from "./components/BackendHealthCheck";

const ProtectedRoute = ({ children }) => {
  const globalUser = useAuthStore((state) => state.globalUser);
  if (!globalUser) return <Navigate to="/login" replace />;
  return children;
};

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const { exp } = JSON.parse(jsonPayload);
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  } catch (error) {
    return true;
  }
};

function App() {
  const { setGlobalUser, globalUser, logout } = useAuthStore();
  const { leaveRoom } = useGameStore();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token && isTokenExpired(token)) {
      console.warn("Token is expired. Logging out...");
      logout();
      leaveRoom();
    }
  }, [logout, leaveRoom]);

  useEffect(() => {
    const theme = import.meta.env.VITE_THEME || 'classic';
    const root = window.document.documentElement;
    if (theme === 'bms') {
      root.classList.remove('dark', 'theme-classic');
      root.classList.add('light', 'theme-bms');
    } else {
      root.classList.remove('light', 'theme-bms');
      root.classList.add('dark', 'theme-classic');
    }
  }, []);

  useEffect(() => {
    // 1. Verificar se estamos num iframe (embedded)
    const params = new URLSearchParams(window.location.search);
    const isEmbedded = params.get('embedded') === 'true';
    const userName = params.get('userName');
    
    if (isEmbedded && userName && !globalUser) {
      // Auto-login simplificado para a POC
      const performAutoLogin = async () => {
        try {
          const response = await api.post('/auth/guest', { name: userName });
          const userData = response.data;
          // Guardar token e usuário
          localStorage.setItem('access_token', userData.access_token);
          setGlobalUser({
            id: userData.id,
            name: userData.name,
            is_guest: true
          });
          console.log("POC: Auto-login realizado como", userName);
        } catch (error) {
          console.error("POC: Falha no auto-login", error);
        }
      };
      performAutoLogin();
    }

    // 2. Notificar o Host que estamos prontos
    if (isEmbedded) {
      window.parent.postMessage({ type: 'POKER_READY' }, '*');
    }
  }, [setGlobalUser, globalUser]);

  return (
    <div className="App">
      <BackendHealthCheck>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Landing /></ProtectedRoute>} />
            <Route path="/room/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </BackendHealthCheck>
    </div>
  );
}

export default App;

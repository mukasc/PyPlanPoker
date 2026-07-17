import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Room from "./pages/Room";
import Login from "./pages/Login";
import AdminPanel from "./pages/AdminPanel";
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

function App() {
  const { setGlobalUser, globalUser, logout } = useAuthStore();
  const { leaveRoom } = useGameStore();

  useEffect(() => {
    // Client no longer checks token expiration manually since it's an HttpOnly cookie
    // Expired sessions will return 401 and trigger logout via interceptor
  }, []);

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
          // Guardar usuário
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
            <Route path="/painel-secreto-admin-xyz" element={<AdminPanel />} />
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

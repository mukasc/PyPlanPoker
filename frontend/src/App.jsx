import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Room from "./pages/Room";
import Login from "./pages/Login";
import useAuthStore from "./store/authStore";

const ProtectedRoute = ({ children }) => {
  const globalUser = useAuthStore((state) => state.globalUser);
  if (!globalUser) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <div className="App dark">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Landing /></ProtectedRoute>} />
          <Route path="/room/:roomId" element={<ProtectedRoute><Room /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;

import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

import { GoogleOAuthProvider } from '@react-oauth/google';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id';

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
);

// --- Início: Configuração de ResizeObserver para o Iframe ---
function setupAutoResize() {
  // Define a origem do host pai (usando '*' para flexibilidade em POC/Dev)
  const PARENT_ORIGIN = '*';

  function sendHeight() {
    const height = document.documentElement.scrollHeight || document.body.scrollHeight;
    window.parent.postMessage({
      type: 'RESIZE_IFRAME',
      height: height
    }, PARENT_ORIGIN);
  }

  // Monitora alterações no body. Quando a interface do React (ex: lista de usuários)
  // aumentar ou diminuir, o ResizeObserver identificará a mudança.
  const resizeObserver = new ResizeObserver(() => {
    sendHeight();
  });

  // O React renderiza a interface dentro de <div id="root">, que empurra o body.
  resizeObserver.observe(document.body);
  
  // Envio inicial (com um pequeno timeout para garantir a renderização inicial do React)
  setTimeout(sendHeight, 100);
}

// Inicializa a funcionalidade apenas se estivermos rodando dentro de um Iframe
if (window.self !== window.top) {
  setupAutoResize();
}
// --- Fim: Configuração de ResizeObserver ---

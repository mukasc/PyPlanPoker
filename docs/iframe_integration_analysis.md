# Análise e Planejamento: Integração do ResizeObserver no PyPlanPoker

Este documento detalha como a aplicação filha (PyPlanPoker) será adaptada para enviar dinamicamente sua altura ao *host* (phantom-app), garantindo o layout fluido sem barras de rolagem duplas.

## Onde a alteração será feita?

A aplicação PyPlanPoker é construída utilizando React e Vite. O ponto de entrada principal do React é o arquivo `frontend/src/index.jsx`.
Para garantir que o `ResizeObserver` monitore corretamente a altura da aplicação após as renderizações do React, a lógica de redimensionamento pode ser inserida diretamente nesse arquivo, agindo de forma global.

### Arquivo a ser alterado:
- `[frontend/src/index.jsx](file:///c:/Users/mukas/.gemini/antigravity-ide/scratch/PyPlanPoker/frontend/src/index.jsx)`

## O que será implementado?

Adicionaremos uma função `setupAutoResize` que faz o seguinte:
1. Define a origem do pai (neste caso usaremos `*` para compatibilidade em dev, podendo evoluir para variável de ambiente em produção).
2. Captura a altura total da página (`scrollHeight`).
3. Dispara a mensagem `RESIZE_IFRAME` usando a API `window.parent.postMessage`.
4. Instancia um `ResizeObserver` apontado para o `document.body` (ou para a root div `#root`). Sempre que o React adicionar elementos, abrir sanfonas, popups na árvore ou exibir novos componentes, o observer disparará o envio da nova altura para o `phantom-app`.

## Código Proposto

Abaixo está o bloco de código que será inserido ao final do arquivo `frontend/src/index.jsx`:

```javascript
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
```

## Por que essa abordagem?

- **Zero Impacto Fora do Iframe**: Ao verificar `if (window.self !== window.top)`, o script garante que o `postMessage` só seja executado quando a aplicação estiver rodando embarcada. Acesso normal (standalone) não sofrerá interferência.
- **Acoplamento Independente de Componente**: Por estar na inicialização da aplicação (root), o observer "abraça" todas as rotas e componentes do sistema sem que precisemos configurar callbacks nos componentes individualmente.
- **Desempenho**: `ResizeObserver` é nativamente otimizado pelos navegadores, não provocando os *lags* tradicionais que ocorreriam se usássemos `window.onresize` com `setTimeout`.

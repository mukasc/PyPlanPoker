// Configurações da POC de Integração
const POKER_CONFIG = {
    // URL de Produção (Altere após fazer o deploy no Vercel)
    PRODUCTION_URL: 'https://seu-poker-no-vercel.vercel.app',
    
    // URL Local padrão
    LOCAL_URL: 'http://localhost:3000',
    
    // Configurações do Usuário Mock
    DEFAULT_USER: 'Gerente POC',
    DEFAULT_AVATAR: 'https://github.com/nutlope.png'
};

if (typeof module !== 'undefined') {
    module.exports = POKER_CONFIG;
}

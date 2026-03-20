import { useEffect, useState } from 'react';
import { Loader2, Server, Timer } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const BackendHealthCheck = ({ children }) => {
  const { isBackendReady, setBackendReady } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [errorCount, setErrorCount] = useState(0);
  const [dbStatus, setDbStatus] = useState('offline');

  useEffect(() => {
    let intervalId;
    
    const checkHealth = async () => {
      try {
        const response = await api.get('/api/health', {
          timeout: 5000,
          _isHealthCheck: true 
        });
        
        const { status, database } = response.data;
        setDbStatus(database || 'offline');

        if (status === 'online' && database === 'online') {
          setBackendReady(true);
          setIsChecking(false);
          if (intervalId) clearInterval(intervalId);
        }
      } catch (error) {
        console.log('Backend ainda acordando...');
        setErrorCount(prev => prev + 1);
        if (!intervalId) {
          intervalId = setInterval(checkHealth, 3000);
        }
      }
    };

    if (!isBackendReady) {
      checkHealth();
    } else {
      setIsChecking(false);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isBackendReady, setBackendReady]);

  if (isChecking && !isBackendReady) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-slate-950">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -inset-[100%] opacity-30">
            <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-emerald-500/20 blur-[120px]" />
            <div className="absolute top-1/3 left-1/4 h-[400px] w-[400px] animate-bounce rounded-full bg-indigo-500/10 blur-[100px] [animation-duration:10s]" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center px-6 text-center">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/5 p-1 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-gradient-to-br from-emerald-500 to-indigo-600 shadow-inner">
               <Server className="h-10 w-10 text-white animate-pulse" />
            </div>
          </div>

          <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            PyPlanPoker
          </h1>
          
          <p className="mb-10 max-w-md text-lg text-slate-400">
            Preparando tudo para você...
          </p>

          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-3 rounded-full bg-white/5 py-2 pl-2 pr-4 ring-1 ring-white/10 backdrop-blur-md">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              </div>
              <span className="text-sm font-medium text-slate-200">
                {dbStatus === 'connecting' 
                  ? 'Conectando ao banco de dados (MongoDB)...' 
                  : errorCount > 0 
                  ? 'Acordando o servidor Render...' 
                  : 'Iniciando conexão...'}
              </span>
            </div>
            
            {errorCount > 2 && (
              <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
                <Timer className="h-4 w-4 text-slate-500" />
                <span className="text-xs text-slate-500 italic">
                  Isso geralmente leva de 30 a 50 segundos no plano gratuito do Render.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* CSS for custom animations if tailwind config doesn't have them */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pulse-slow {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
          }
        `}} />
      </div>
    );
  }

  return children;
};

export default BackendHealthCheck;

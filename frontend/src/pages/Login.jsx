import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Sparkles, User, ArrowRight } from 'lucide-react';
import { Toaster, toast } from '../components/ui/sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const { globalUser, setGlobalUser } = useAuthStore();
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (globalUser && token) {
      navigate('/');
    }
  }, [globalUser, navigate]);

  const handleSuccess = async (response) => {
    try {
      const res = await api.post('/api/auth/google', { credential: response.credential });
      if (res.data.access_token) {
        localStorage.setItem('access_token', res.data.access_token);
      }
      setGlobalUser(res.data);
      toast.success('Successfully logged in');
      navigate('/');
    } catch (error) {
       console.error(error);
       toast.error('Failed to log in');
    }
  };

  const handleGuestLogin = async (e) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error('Please enter a display name');
      return;
    }
    
    try {
      const res = await api.post('/api/auth/guest', { name: guestName.trim() });
      if (res.data.access_token) {
        localStorage.setItem('access_token', res.data.access_token);
      }
      setGlobalUser(res.data);
      toast.success('Joined as Guest');
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error('Guest login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>
      <Toaster position="top-center" theme="dark" />
      
      <div className="text-center mb-12 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-slate-200 tracking-tight font-mono">
            PyPlanPoker
          </h1>
        </div>
        <p className="text-slate-400 text-lg">
          Sign in to start estimating with your team
        </p>
      </div>

      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl shadow-black/50 relative z-10 flex flex-col items-center p-6">
         <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl text-slate-200 font-mono">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-slate-400 mb-6">
            Please sign in using your Google account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col justify-center items-center w-full mt-4 space-y-4">
           {!showGuestForm ? (
             <>
               <GoogleLogin
                 shape="pill"
                 onSuccess={handleSuccess}
                 onError={() => toast.error('Google Sign-In Failed')}
               />
               
               <div className="relative w-full my-4">
                 <div className="absolute inset-0 flex items-center">
                   <span className="w-full border-t border-slate-800" />
                 </div>
                 <div className="relative flex justify-center text-xs uppercase">
                   <span className="bg-slate-900 px-2 text-slate-500">Or continue with</span>
                 </div>
               </div>
               
               <Button 
                 variant="outline" 
                 onClick={() => setShowGuestForm(true)}
                 className="w-full bg-slate-800/50 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 h-10 rounded-full"
               >
                 <User className="w-4 h-4 mr-2" />
                 Continue as Guest
               </Button>
             </>
           ) : (
             <form onSubmit={handleGuestLogin} className="w-full space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Display Name</label>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setShowGuestForm(false)}
                    className="w-1/3 text-slate-400 hover:text-white"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Join
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
             </form>
           )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

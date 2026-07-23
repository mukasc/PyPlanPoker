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
import ThemeToggle from '../components/ThemeToggle';

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
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/90/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>
      <Toaster position="top-center" theme="dark" />
      
      <div className="text-center mb-12 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-foreground tracking-tight font-mono">
            PyPlanPoker
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Sign in to start estimating with your team
        </p>
      </div>

      <Card className="w-full max-w-md bg-card border-border shadow-2xl shadow-black/50 relative z-10 flex flex-col items-center p-6">
         <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl text-card-foreground font-mono">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-muted-foreground mb-6">
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
                   <span className="w-full border-t border-border" />
                 </div>
                 <div className="relative flex justify-center text-xs uppercase">
                   <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                 </div>
               </div>
               
               <Button 
                 variant="outline" 
                 onClick={() => setShowGuestForm(true)}
                 className="w-full h-10 rounded-full"
               >
                 <User className="w-4 h-4 mr-2" />
                 Continue as Guest
               </Button>
             </>
           ) : (
             <form onSubmit={handleGuestLogin} className="w-full space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Display Name</label>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setShowGuestForm(false)}
                    className="w-1/3 text-muted-foreground hover:text-foreground"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
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

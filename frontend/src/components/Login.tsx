import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { ShieldCheck, Lock, User, Zap } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const success = await login(username, password);
      if (success) {
        navigate('/');
      } else {
        setError('Неверный логин или пароль');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] flex items-center justify-center p-6 transition-colors duration-500 relative overflow-hidden">
      {/* Декоративные элементы фона */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-600/10 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-600/10 blur-[120px] rounded-full"></div>

      <div className="max-w-md w-full relative z-10">
        {/* Логотип */}
        <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="p-5 bg-blue-600 rounded-[1.5rem] shadow-2xl shadow-blue-500/40 mb-6 text-white transform hover:rotate-12 transition-transform duration-500">
            <Zap className="w-10 h-10 fill-current" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">AMPERE</h1>
          <p className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-[0.4em] mt-3">Smart Charging Station</p>
        </div>

        {/* Форма */}
        <div className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 rounded-[3rem] p-10 shadow-sm dark:shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-8 uppercase tracking-widest text-center">Авторизация</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-app-muted uppercase ml-4 tracking-widest">Логин</label>
              <div className="relative">
                <div className="absolute left-5 top-5 text-slate-400 dark:text-gray-500">
                  <User className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  required
                  placeholder="admin"
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 p-5 pl-14 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:text-white font-bold transition-all placeholder:text-slate-300 dark:placeholder:text-gray-700"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 dark:text-app-muted uppercase ml-4 tracking-widest">Пароль</label>
              <div className="relative">
                <div className="absolute left-5 top-5 text-slate-400 dark:text-gray-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 p-5 pl-14 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:text-white font-bold transition-all placeholder:text-slate-300 dark:placeholder:text-gray-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs font-bold uppercase tracking-widest text-center animate-shake">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] font-black uppercase text-xs shadow-2xl shadow-blue-500/30 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 group"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Войти в систему
                  <ShieldCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Подвал */}
        <p className="text-center mt-10 text-[10px] font-black text-slate-400 dark:text-gray-600 uppercase tracking-[0.3em]">
           2026 AMPERE ENERGY SYSTEMS
        </p>
      </div>
    </div>
  );
};

export default Login;
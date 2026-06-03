import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Zap, Lock, User, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Имитация задержки сети
    setTimeout(() => {
      const success = login(username, password);
      if (success) {
        navigate('/');
      } else {
        setError('Неверный логин или пароль');
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-app-bg transition-colors p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 bg-white dark:bg-app-card rounded-3xl shadow-xl shadow-blue-500/10 border border-gray-100 dark:border-app-border mb-4 transition-all hover:scale-105">
            <Zap className="w-10 h-10 text-blue-500 fill-blue-500/10" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">AMPERE NEW</h1>
          <p className="text-gray-400 dark:text-gray-500 font-medium">Система управления зарядными станциями</p>
        </div>

        <div className="bg-white dark:bg-app-card p-8 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-app-border">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl text-sm font-bold animate-in fade-in zoom-in-95">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Логин"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-app-bg border border-gray-200 dark:border-app-border rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
                  required
                />
              </div>

              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="password"
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-app-bg border border-gray-200 dark:border-app-border rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gray-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-gray-200 dark:shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {isLoading ? 'ВХОД...' : 'ВОЙТИ'}
            </button>
          </form>
        </div>

        <div className="text-center">
          <p className="text-[10px] text-gray-300 dark:text-gray-600 font-bold uppercase tracking-[0.2em]">
            Тестовый доступ: admin2026 / kasa2026 / buhgalter2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

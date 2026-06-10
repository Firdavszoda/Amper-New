import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useStore } from './store/useStore';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import CashierDashboard from './components/CashierDashboard';
import AdminDashboard from './components/AdminDashboard';
import FinancierDashboard from './components/FinancierDashboard';
import ReportsDashboard from './components/ReportsDashboard';

import { Sun, Moon, RefreshCw } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, isDarkMode, setIsDarkMode }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentShift, closeShift } = useStore();
  const [shiftReport, setShiftReport] = React.useState<{ revenue: number } | null>(null);

  const handleLogout = () => {
    if (user?.role === 'cashier' && currentShift) {
      alert('Сначала закройте кассовую смену, чтобы выйти из системы!');
      return;
    }
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen transition-colors duration-300 flex flex-col">
      {user && (
        <nav className="w-full bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-white/10 px-6 py-3 flex items-center justify-between z-50 sticky top-0 shadow-sm dark:shadow-none">
          
          {/* ЛЕВАЯ ЧАСТЬ: Логотип и Статус */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <span className="text-xl font-black text-slate-900 dark:text-white tracking-widest uppercase">Ampere</span>
            </div>

            {/* Навигация */}
            <div className="flex items-center gap-1">
              {user.role === 'cashier' && (
                <button 
                  onClick={() => navigate('/reports')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${location.pathname === '/reports' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
                >
                  Отчеты
                </button>
              )}
            </div>
          </div>

          {/* ПРАВАЯ ЧАСТЬ: Тема, Кнопка закрытия, Профиль, Выход */}
          <div className="flex items-center gap-6">
            
            {/* Обновить данные */}
            <button 
              onClick={() => window.location.reload()}
              className="hidden md:flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
              title="Обновить данные страницы"
            >
              <RefreshCw size={14} className="text-indigo-500 dark:text-indigo-400" /> Обновить данные
            </button>

            {/* Переключатель темы */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/20 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-white/5 shadow-sm"
              title={isDarkMode ? 'Переключить на светлую' : 'Переключить на темную'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* БЛОК СМЕНЫ: Показываем только если смена реально открыта */}
            {currentShift && (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">Смена открыта</span>
                </div>

                <button 
                  onClick={async () => {
                    if(window.confirm('Вы точно хотите завершить текущую смену?')) {
                      try { 
                        const result = await (closeShift as any)(currentShift.id);
                        setShiftReport(result);
                      } catch (e) { 
                        console.error(e); 
                      }
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 flex items-center gap-2 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Завершить смену
                </button>
              </div>
            )}

            {/* Профиль кассира */}
            <div className="flex items-center gap-4 border-l border-slate-200 dark:border-white/10 pl-6">
              <div className="text-right">
                <div className="text-slate-900 dark:text-white font-bold text-sm">{user?.username || 'kasa'}</div>
                <div className="text-slate-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest">{user?.role || 'CASHIER'}</div>
              </div>
              <button onClick={handleLogout} className="p-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* МОДАЛКА ИТОГА СМЕНЫ (КРАСИВАЯ) */}
      {shiftReport && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
            {/* Декоративный фон */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[80px]"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[80px]"></div>

            <div className="relative z-10">
              <div className="w-20 h-20 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 dark:border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <svg className="w-10 h-10 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>

              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Смена завершена</h3>
              <p className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mb-8">Итоговый отчет</p>

              <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl p-6 mb-8 shadow-inner">
                <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black tracking-widest mb-1">Общая выручка</p>
                <p className="text-4xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {shiftReport.revenue.toFixed(2)} <span className="text-sm opacity-50">TJS</span>
                </p>
              </div>

              <button 
                onClick={() => setShiftReport(null)}
                className="w-full bg-slate-900 dark:bg-white/10 hover:bg-slate-800 dark:hover:bg-white/20 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-widest transition-all active:scale-95 border border-transparent dark:border-white/10 shadow-lg shadow-slate-900/10 dark:shadow-none"
              >
                Закрыть отчет
              </button>
            </div>
          </div>
        </div>
      )}

      <main>{children}</main>
    </div>
  );
};

const RootRedirect = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  
  switch (user.role) {
    case 'admin': return <Navigate to="/admin" replace />;
    case 'cashier': return <Navigate to="/cashier" replace />;
    case 'financier': return <Navigate to="/finance" replace />;
    default: return <Navigate to="/login" replace />;
  }
};

function App() {
  // Инициализируем тему, проверяя localStorage или системные настройки
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('ampere_theme');
      if (savedTheme) {
        return savedTheme === 'dark';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true; 
  });

  // Этот эффект физически добавляет/удаляет класс 'dark' у тега <html>
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('ampere_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('ampere_theme', 'light');
    }
  }, [isDarkMode]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<ProtectedRoute><Layout isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}><RootRedirect /></Layout></ProtectedRoute>} />
        
        <Route path="/cashier" element={
          <ProtectedRoute allowedRoles={['cashier', 'admin']}>
            <Layout isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}><CashierDashboard /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}><AdminDashboard /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/finance" element={
          <ProtectedRoute allowedRoles={['financier', 'admin']}>
            <Layout isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}><FinancierDashboard /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={['admin', 'financier', 'cashier']}>
            <Layout isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}><ReportsDashboard /></Layout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Wallet, Calendar, ArrowUpRight, Filter, Download, Zap, LogOut, BarChart3, LayoutGrid } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const FinancierDashboard: React.FC = () => {
  const { fetchStations } = useStore();
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    fetchStations();
    api.getAnalytics().then(setAnalytics).catch(console.error);
  }, [fetchStations]);

  const totalRevenue = analytics?.totalRevenue || 0;
  const stationStats = analytics?.stationStats || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-app-bg flex transition-colors overflow-hidden">
      
      {/* МЕНЮ НАВИГАЦИИ (SIDEBAR) */}
      <aside className="w-24 md:w-80 bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-white/10 flex flex-col p-6 space-y-10 z-50 shadow-2xl">
        <div className="flex items-center gap-4 px-2">
          <div className="p-4 bg-emerald-600 rounded-[1.25rem] shadow-2xl shadow-emerald-500/40 text-white">
            <Wallet className="w-6 h-6 fill-current" />
          </div>
          <div className="hidden md:block">
            <span className="font-black text-2xl text-slate-900 dark:text-white tracking-tighter uppercase leading-none text-left block">AMPERE</span>
            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1 text-left">Финансовый учет</p>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          <NavItem active={true} icon={<BarChart3 />} label="Дашборд" onClick={() => {}} />
          <button 
            onClick={() => navigate('/reports')}
            className="w-full flex items-center gap-5 p-5 rounded-[1.25rem] transition-all text-slate-500 dark:text-app-muted hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white group text-left"
          >
            <Zap className="w-5 h-5 text-left" />
            <span className="hidden md:block font-black uppercase text-[11px] tracking-widest text-left">Отчеты</span>
          </button>
        </nav>

        <div className="pt-6 border-t border-slate-100 dark:border-app-border">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-slate-400 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all group"
          >
            <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="hidden md:block font-black uppercase text-[11px] tracking-widest text-left">Выйти</span>
          </button>
        </div>
      </aside>

      {/* ОБЛАСТЬ КОНТЕНТА */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-left">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter text-left">Финансовый контроль</h1>
              <p className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mt-1 text-left">Анализ доходов и эффективности</p>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-app-card border border-slate-200 dark:border-app-border rounded-xl text-xs font-bold text-slate-500 dark:text-app-muted hover:bg-slate-50 dark:hover:bg-white/5 transition-colors uppercase tracking-widest shadow-sm">
                <Filter className="w-4 h-4" /> Фильтры
              </button>
              <button 
                onClick={() => api.reports.downloadCsv({})}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest active:scale-95"
              >
                <Download className="w-4 h-4" /> Экспорт
              </button>
            </div>
          </header>

          {/* Main Financial Card */}
          <div className="bg-emerald-500 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl shadow-emerald-500/30">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-end md:items-center gap-6 text-left">
              <div className="space-y-4">
                <p className="text-xs font-black opacity-80 uppercase tracking-[0.3em]">Выручка за текущий период</p>
                <h2 className="text-6xl font-black font-mono tracking-tighter">{totalRevenue.toFixed(2)} <span className="text-2xl opacity-60 font-sans">TJS</span></h2>
              </div>
              <div className="flex gap-4">
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                  <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-2">Средний чек</p>
                  <p className="text-2xl font-black font-mono tracking-tight text-left">112.5</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10">
                  <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-2">Прирост</p>
                  <p className="text-2xl font-black font-mono flex items-center gap-2 text-emerald-100 tracking-tight text-left">
                    +12.4% <ArrowUpRight className="w-6 h-6" />
                  </p>
                </div>
              </div>
            </div>
            <Calendar className="absolute -right-16 -bottom-16 w-80 h-80 opacity-10 rotate-12" />
          </div>

          {/* Station Revenue Table */}
          <section className="space-y-6">
            <h2 className="text-sm font-black text-slate-400 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2 text-left">
              <LayoutGrid className="w-4 h-4 text-left" /> Отчет по станциям
            </h2>
            <div className="bg-white dark:bg-app-card rounded-[2.5rem] shadow-sm dark:shadow-2xl border border-slate-200 dark:border-app-border overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-app-bg text-slate-400 dark:text-app-muted uppercase text-[10px] font-black tracking-widest border-b border-slate-200 dark:border-app-border">
                  <tr>
                    <th className="py-6 px-8">Станция</th>
                    <th className="py-6 px-8 text-center">Статус</th>
                    <th className="py-6 px-8 text-right">Энергия (kWh)</th>
                    <th className="py-6 px-8 text-right">Доход (TJS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-app-border">
                  {stationStats.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                      <td className="py-6 px-8 font-black text-slate-900 dark:text-white uppercase text-sm text-left">{s.name}</td>
                      <td className="py-6 px-8 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm ${
                          s.status === 'online' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-400 text-white'
                        }`}>
                          {s.status === 'online' ? 'В сети' : 'Оффлайн'}
                        </span>
                      </td>
                      <td className="py-6 px-8 text-right font-mono font-bold text-slate-500 dark:text-gray-400">{s.energy.toFixed(1)}</td>
                      <td className="py-6 px-8 text-right font-black font-mono text-lg text-emerald-600 dark:text-emerald-500 tracking-tighter">{s.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ active, icon, label, onClick }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-5 p-5 rounded-[1.25rem] transition-all relative group ${active ? 'bg-emerald-600 text-white shadow-[0_15px_30px_rgba(16,185,129,0.3)] scale-[1.02]' : 'text-slate-500 dark:text-app-muted hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}
  >
    {React.cloneElement(icon, { className: `w-5 h-5 ${active ? 'fill-current' : ''}` })}
    <span className="hidden md:block font-black uppercase text-[11px] tracking-widest text-left">{label}</span>
    {active && <div className="absolute right-4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#fff]" />}
  </button>
);

export default FinancierDashboard;
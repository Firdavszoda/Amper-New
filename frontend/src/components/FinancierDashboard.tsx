import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Wallet, Calendar, ArrowUpRight, Filter, Download } from 'lucide-react';
import { api } from '../services/api';

const FinancierDashboard: React.FC = () => {
  const { fetchStations } = useStore();
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    fetchStations();
    api.getAnalytics().then(setAnalytics).catch(console.error);
  }, [fetchStations]);

  const totalRevenue = analytics?.totalRevenue || 0;
  const stationStats = analytics?.stationStats || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-app-bg p-4 md:p-8 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              <Wallet className="w-8 h-8 text-emerald-500" />
              FINANCIAL CONTROL
            </h1>
            <p className="text-gray-400 text-sm font-medium mt-1">Управление доходами и аналитика</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-app-card border border-gray-100 dark:border-app-border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" /> Фильтры
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors">
              <Download className="w-4 h-4" /> Экспорт
            </button>
          </div>
        </header>

        {/* Main Financial Card */}
        <div className="bg-emerald-500 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
            <div className="space-y-2">
              <p className="text-sm font-bold opacity-80 uppercase tracking-widest">Общая выручка за период</p>
              <h2 className="text-5xl font-black font-mono">{totalRevenue.toFixed(2)} TJS</h2>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl">
                <p className="text-[10px] font-bold opacity-70 uppercase mb-1">Средний чек</p>
                <p className="text-xl font-black font-mono">112.5 TJS</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl">
                <p className="text-[10px] font-bold opacity-70 uppercase mb-1">Рост</p>
                <p className="text-xl font-black font-mono flex items-center gap-1">
                  +12.4% <ArrowUpRight className="w-4 h-4" />
                </p>
              </div>
            </div>
          </div>
          <Calendar className="absolute -right-12 -bottom-12 w-64 h-64 opacity-10 rotate-12" />
        </div>

        {/* Station Revenue Table */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Отчет по станциям</h2>
          <div className="bg-white dark:bg-app-card rounded-3xl shadow-sm border border-gray-100 dark:border-app-border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-app-border">
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-wider text-gray-400">Станция</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-wider text-gray-400">Статус</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-wider text-gray-400 text-right">Энергия (kWh)</th>
                  <th className="py-5 px-6 text-[10px] font-black uppercase tracking-wider text-gray-400 text-right">Доход (TJS)</th>
                </tr>
              </thead>
              <tbody>
                {stationStats.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50 dark:border-app-border hover:bg-gray-50 dark:hover:bg-app-bg/30 transition-colors">
                    <td className="py-5 px-6 font-bold text-gray-900 dark:text-white">{s.name}</td>
                    <td className="py-5 px-6">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                        s.status === 'online' ? 'text-emerald-500 bg-emerald-50' : 'text-gray-500 bg-gray-50'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-right font-mono text-gray-500">{s.energy.toFixed(1)}</td>
                    <td className="py-5 px-6 text-right font-black font-mono text-emerald-500">{s.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FinancierDashboard;

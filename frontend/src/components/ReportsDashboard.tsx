import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import CashierReport from './CashierReport';

export default function ReportsDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'transactions' | 'finance' | 'shifts'>('transactions');
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total_tjs: 0, total_kwh: 0, total_sessions: 0 });
  const [analytics, setAnalytics] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = React.useCallback(async () => {
    try {
      if (activeTab === 'transactions') {
        const res = await api.reports.getTransactions({ page, limit: 15 });
        setData(res.data);
        setTotalPages(res.pagination.totalPages);
        
        const sum = await api.reports.getSummary({});
        setSummary(sum);
      } else if (activeTab === 'finance' && user?.role !== 'cashier') {
        const res = await api.reports.getAnalytics({});
        setAnalytics(res);
      }
    } catch (e) { console.error('Ошибка загрузки отчетов', e); }
  }, [activeTab, page, user]);

  useEffect(() => { 
    const timer = setTimeout(() => {
      if (activeTab !== 'shifts') {
        loadData();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData, activeTab]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white">Отчеты</h2>
      </div>

      {/* Вкладки навигации */}
      <div className="flex flex-wrap gap-4 mb-6 border-b border-slate-200 dark:border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab('transactions')} 
          className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'transactions' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
        >
          Журнал транзакций
        </button>
        <button 
          onClick={() => setActiveTab('shifts')} 
          className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'shifts' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
        >
          Отчет кассиров
        </button>
        {user?.role !== 'cashier' && (
          <button 
            onClick={() => setActiveTab('finance')} 
            className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'finance' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
          >
            Финансы и Аналитика
          </button>
        )}
      </div>

      {activeTab === 'shifts' && <CashierReport />}

      {activeTab === 'transactions' && (
        <>
          {/* СВОДКА */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white dark:bg-[#1a1f2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10">
                <svg className="w-12 h-12 text-slate-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
              </div>
              <div className="text-slate-400 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Общая выручка</div>
              <div className="text-3xl font-mono font-black text-slate-900 dark:text-white">{summary.total_tjs?.toFixed(2) || 0} <span className="text-sm opacity-50">TJS</span></div>
            </div>
            
            <div className="bg-white dark:bg-[#1a1f2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10">
                <svg className="w-12 h-12 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div className="text-slate-400 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Потреблено энергии</div>
              <div className="text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400">{summary.total_kwh?.toFixed(3) || 0} <span className="text-sm opacity-50">kWh</span></div>
            </div>

            <div className="bg-white dark:bg-[#1a1f2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 dark:opacity-10">
                <svg className="w-12 h-12 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>
              </div>
              <div className="text-slate-400 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Всего сессий</div>
              <div className="text-3xl font-mono font-black text-blue-600 dark:text-blue-400">{summary.total_sessions || 0} <span className="text-sm opacity-50">шт</span></div>
            </div>
          </div>

          {/* ТАБЛИЦА */}
          <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-500 dark:text-gray-400">
                <thead className="text-[10px] uppercase bg-slate-50 dark:bg-black/40 text-slate-500 dark:text-gray-500 font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-5">ID</th>
                    <th className="px-6 py-5">Кассир</th>
                    <th className="px-6 py-5">Станция / Коннектор</th>
                    <th className="px-6 py-5 text-emerald-600 dark:text-emerald-400">Энергия</th>
                    <th className="px-6 py-5 text-slate-900 dark:text-white">Сумма</th>
                    <th className="px-6 py-5 text-right">Дата и время</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {data.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs text-slate-400 dark:text-gray-500">#{tx.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[10px] font-black text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-white/10">
                            {tx.cashier_name?.[0].toUpperCase() || 'A'}
                          </div>
                          <span className="font-bold text-slate-700 dark:text-white text-xs uppercase tracking-tight">{tx.cashier_name || 'Автономно'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-slate-600 dark:text-gray-300">{tx.station_name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-bold">{tx.connector_name}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {tx.consumed_kwh?.toFixed(3)} <span className="text-[10px] opacity-50">kW</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-lg font-black text-slate-900 dark:text-white font-mono text-sm border border-slate-100 dark:border-white/5">
                          {tx.amount_tjs?.toFixed(2)} <span className="text-[10px] opacity-40">TJS</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-tighter">
                        {new Date(tx.created_at).toLocaleString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-400 dark:text-gray-500 uppercase text-xs font-black tracking-widest">
                        Нет данных за выбранный период
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ПАГИНАЦИЯ */}
          <div className="flex items-center justify-between mt-8 bg-white dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={page === 1} 
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 rounded-xl disabled:opacity-20 transition-all font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-white/5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              Назад
            </button>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Страница</span>
              <span className="w-10 h-10 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-sm border border-emerald-500/20">{page}</span>
              <span className="text-slate-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">из</span>
              <span className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-lg flex items-center justify-center text-slate-600 dark:text-white font-black text-sm border border-slate-200 dark:border-white/10">{totalPages}</span>
            </div>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
              disabled={page === totalPages} 
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-gray-300 rounded-xl disabled:opacity-20 transition-all font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-white/5"
            >
              Вперед
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </>
      )}

      {activeTab === 'finance' && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
          {/* Доход по месяцам */}
          <div className="bg-white dark:bg-[#1a1f2e] p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-2xl">
            <h3 className="text-slate-900 dark:text-white font-black mb-6 uppercase tracking-widest text-xs flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Доход по месяцам
            </h3>
            <div className="space-y-4">
              {analytics.byMonth.map((m: any) => (
                <div key={m.period} className="flex justify-between items-center bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-100 dark:border-white/5 hover:border-blue-500/30 transition-all group">
                  <span className="text-slate-500 dark:text-gray-400 font-mono font-bold group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{m.period}</span>
                  <div className="text-right">
                    <div className="text-emerald-600 dark:text-emerald-400 font-black text-lg">{m.revenue?.toFixed(2)} <span className="text-[10px] opacity-50">TJS</span></div>
                    <div className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-black">{m.sessions} сессий / {m.kwh?.toFixed(1)} kWh</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Рейтинг кассиров */}
          <div className="bg-white dark:bg-[#1a1f2e] p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-2xl">
            <h3 className="text-slate-900 dark:text-white font-black mb-6 uppercase tracking-widest text-xs flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Выручка по сотрудникам
            </h3>
            <div className="space-y-4">
              {analytics.byCashier.map((c: any, i: number) => (
                <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-100 dark:border-white/5 hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border transition-all ${i === 0 ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-400 border-slate-200 dark:border-white/10'}`}>
                      {i + 1}
                    </div>
                    <div className="text-left">
                      <span className="text-slate-700 dark:text-white font-black uppercase text-xs tracking-widest block">{c.name || 'Автономно'}</span>
                      <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase">{c.sessions} сессий проведено</span>
                    </div>
                  </div>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black text-lg">{c.revenue?.toFixed(2)} <span className="text-[10px] opacity-50">TJS</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Доход по станциям */}
          <div className="lg:col-span-2 bg-white dark:bg-[#1a1f2e] p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-2xl">
            <h3 className="text-slate-900 dark:text-white font-black mb-6 uppercase tracking-widest text-xs flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              Эффективность станций
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.byStation.map((s: any, i: number) => (
                <div key={i} className="bg-slate-50 dark:bg-black/20 p-5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-amber-500/30 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-slate-700 dark:text-white font-black uppercase text-[10px] tracking-widest bg-slate-100 dark:bg-white/5 px-2 py-1 rounded border border-slate-200 dark:border-white/5">{s.name}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-black font-mono text-sm">{s.revenue?.toFixed(0)} TJS</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">
                    <span>Потребление</span>
                    <span className="text-slate-600 dark:text-gray-300 font-mono">{s.kwh?.toFixed(1)} kWh</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
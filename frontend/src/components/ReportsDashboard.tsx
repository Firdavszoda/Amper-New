import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import CashierReport from './CashierReport';
import { Calendar, MapPin, User as UserIcon, Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ReportsDashboard() {
  const { user } = useAuthStore();
  const { fetchStations } = useStore();
  const [activeTab, setActiveTab] = useState<'transactions' | 'cashiers' | 'shifts'>('transactions');
  const [data, setData] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total_tjs: 0, total_kwh: 0, total_sessions: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Фильтры для смен
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedCashierShifts, setSelectedCashierShifts] = useState('all');
  const [cashiers, setCashiers] = useState<any[]>([]);

  useEffect(() => {
    fetchStations();
    if (user?.role !== 'cashier') {
      api.reports.getCashiers().then(setCashiers).catch(console.error);
    }
  }, [user]);

  const loadData = React.useCallback(async () => {
    try {
      if (activeTab === 'transactions') {
        const res = await api.reports.getTransactions({ page, limit: 15 });
        setData(res.data);
        setTotalPages(res.pagination.totalPages);
        
        const sum = await api.reports.getSummary({});
        setSummary(sum);
      } else if (activeTab === 'shifts') {
        const params = new URLSearchParams({ startDate, endDate, cashier: selectedCashierShifts });
        const res = await fetch(`http://localhost:3000/api/reports/shifts-list?${params}`);
        if (res.ok) {
          const shiftData = await res.json();
          setShifts(shiftData);
        }
      }
    } catch (e) { console.error('Ошибка загрузки отчетов', e); }
  }, [activeTab, page, startDate, endDate, selectedCashierShifts]);

  useEffect(() => { 
    loadData();
  }, [loadData]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU', { 
      timeZone: 'Asia/Dushanbe', 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const exportShiftsToExcel = () => {
    const excelData = shifts.map((sh: any) => ({
      'Кассир': sh.cashier_name,
      'Открытие смены': formatDate(sh.start_time),
      'Закрытие смены': sh.status === 'open' ? 'ОТКРЫТА' : formatDate(sh.end_time),
      'Отдано энергии (kWh)': sh.total_kwh?.toFixed(3) || '0.000',
      'Касса (TJS)': sh.total_tjs?.toFixed(2) || '0.00'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет по сменам");
    XLSX.writeFile(workbook, `Отчет_смен_${startDate}_${endDate}.xlsx`);
  };

  const inputClass = "w-full bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all";

  // Считаем сводку по сменам
  const shiftsSummary = shifts.reduce((acc, sh) => ({
    total_kwh: acc.total_kwh + (sh.total_kwh || 0),
    total_tjs: acc.total_tjs + (sh.total_tjs || 0)
  }), { total_kwh: 0, total_tjs: 0 });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white">Отчеты</h2>
      </div>

      {/* Вкладки навигации */}
      <div className="flex flex-wrap gap-4 mb-6 border-b border-slate-200 dark:border-white/10 pb-4">
        <button 
          onClick={() => { setActiveTab('transactions'); setPage(1); }} 
          className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'transactions' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
        >
          Журнал транзакций
        </button>
        <button 
          onClick={() => setActiveTab('cashiers')} 
          className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'cashiers' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
        >
          Отчет кассиров
        </button>
        <button 
          onClick={() => setActiveTab('shifts')} 
          className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${activeTab === 'shifts' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
        >
          Смены
        </button>
      </div>

      {activeTab === 'shifts' && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#1a1f2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white">Отчет по сменам</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Архив закрытых кассовых смен</p>
            </div>
            <button onClick={exportShiftsToExcel} disabled={shifts.length === 0} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md shadow-emerald-500/20">
              <Download size={16} /> Скачать Excel
            </button>
          </div>

           {/* ФИЛЬТРЫ СМЕН */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-black/20 p-5 rounded-2xl border border-slate-100 dark:border-white/5 items-end">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Calendar size={12}/> От даты</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Calendar size={12}/> До даты</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><UserIcon size={12}/> Кассир</label>
                <select 
                  value={selectedCashierShifts} 
                  onChange={(e) => setSelectedCashierShifts(e.target.value)} 
                  disabled={user?.role === 'cashier'}
                  className={`${inputClass} disabled:opacity-50 cursor-not-allowed`}
                >
                  {user?.role === 'cashier' ? (
                    <option value={user.username}>{user.username}</option>
                  ) : (
                    <>
                      <option value="all">Все</option>
                      {cashiers.map(c => <option key={c.id} value={c.username}>{c.username}</option>)}
                    </>
                  )}
                </select>
              </div>
              <button 
                onClick={() => loadData()} 
                className="w-[150px] bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
              >
                 Поиск
              </button>
           </div>

           {/* СВОДКА ПО СМЕНАМ */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white dark:bg-[#1a1f2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl">
              <div className="text-slate-400 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Всего смен</div>
              <div className="text-2xl font-mono font-black text-slate-900 dark:text-white">{shifts.length} <span className="text-sm opacity-50">записей</span></div>
            </div>
            <div className="bg-white dark:bg-[#1a1f2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl">
              <div className="text-slate-400 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Отдано энергии</div>
              <div className="text-2xl font-mono font-black text-emerald-500">{shiftsSummary.total_kwh.toFixed(3)} <span className="text-sm opacity-50">kWh</span></div>
            </div>
            <div className="bg-white dark:bg-[#1a1f2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl">
              <div className="text-slate-400 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">Общая касса</div>
              <div className="text-2xl font-mono font-black text-blue-500">{shiftsSummary.total_tjs.toFixed(2)} <span className="text-sm opacity-50">TJS</span></div>
            </div>
           </div>

           {/* ТАБЛИЦА СМЕН */}
           <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-500 dark:text-gray-400">
                <thead className="text-[10px] uppercase bg-slate-50 dark:bg-black/40 text-slate-500 dark:text-gray-500 font-black tracking-widest">
                  <tr>
                    <th className="px-6 py-5">Кассир</th>
                    <th className="px-6 py-5">Открыта</th>
                    <th className="px-6 py-5">Закрыта</th>
                    <th className="px-6 py-5 text-right">Энергия (kWh)</th>
                    <th className="px-6 py-5 text-right">Сумма (TJS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {shifts.map((sh) => (
                    <tr key={sh.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                         <div className="font-black text-indigo-500 uppercase text-xs">{sh.cashier_name}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                         {formatDate(sh.start_time)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                         {sh.status === 'open' ? <span className="text-emerald-500 font-bold uppercase text-[9px]">В ПРОЦЕССЕ</span> : formatDate(sh.end_time)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-emerald-500">
                        {sh.total_kwh?.toFixed(3) || '0.000'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-lg font-black text-slate-900 dark:text-white font-mono text-sm border border-slate-100 dark:border-white/5">
                          {sh.total_tjs?.toFixed(2) || '0.00'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
           </div>
        </div>
      )}

      {activeTab === 'cashiers' && <CashierReport />}

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
                    <th className="px-6 py-5">Дата и время</th>
                    <th className="px-6 py-5">Кассир</th>
                    <th className="px-6 py-5">Станция / Коннектор</th>
                    <th className="px-6 py-5 text-right text-emerald-600 dark:text-emerald-400">Энергия</th>
                    <th className="px-6 py-5 text-right text-slate-900 dark:text-white">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {data.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                          {formatDate(tx.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-indigo-500 uppercase text-[11px]">
                          {tx.cashier_name || 'СИСТЕМА'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-slate-600 dark:text-gray-300">{tx.station_name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-bold">{tx.connector_name}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {tx.consumed_kwh?.toFixed(3)} <span className="text-[10px] opacity-50">kW</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-lg font-black text-slate-900 dark:text-white font-mono text-sm border border-slate-100 dark:border-white/5">
                          {tx.amount_tjs?.toFixed(2)} <span className="text-[10px] opacity-40">TJS</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-slate-400 dark:text-gray-500 uppercase text-xs font-black tracking-widest">
                        Нет данных
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

    </div>
  );
}
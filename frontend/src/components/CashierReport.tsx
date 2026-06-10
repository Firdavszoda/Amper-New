import { useState, useEffect } from 'react';
import { Download, Calendar, MapPin, User } from 'lucide-react';
import { useStore } from '../store/useStore';
import * as XLSX from 'xlsx';
import { api } from '../services/api';

const CashierReport = () => {
  const { stations } = useStore();
  // По умолчанию: за сегодня
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedStation, setSelectedStation] = useState('all');
  const [selectedCashier, setSelectedCashier] = useState('all');
  
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [reportData, setReportData] = useState({ total_revenue: 0, total_kwh: 0, operations_count: 0, transactions: [] });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Получаем реальных кассиров
    api.reports.getCashiers().then(setCashiers).catch(console.error);
  }, []);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate, stationId: selectedStation, cashier: selectedCashier });
      
      // ИСПРАВЛЕННАЯ СТРОКА: Добавлен точный адрес бэкенда (http://localhost:3000)
      const res = await fetch(`http://localhost:3000/api/reports/cashiers?${params}`);
      
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (e) {
      console.error('Ошибка загрузки отчета:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate, selectedStation, selectedCashier]);

  const exportToExcel = () => {
    // Подготавливаем данные для Excel
    const excelData = reportData.transactions.map((tx: any) => ({
      'Дата и Время': tx.created_at ? new Date(tx.created_at).toLocaleString('ru-RU') : 'N/A',
      'Колонка': tx.station_name,
      'Ручка': tx.connector_name,
      'Энергия (kWh)': tx.consumed_kwh?.toFixed(3),
      'Сумма (TJS)': tx.amount_tjs?.toFixed(2),
      'Кассир': tx.cashier_name || 'Не указан'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Отчет");
    
    // Скачиваем файл
    XLSX.writeFile(workbook, `Отчет_кассиров_${startDate}_${endDate}.xlsx`);
  };

  const inputClass = "w-full bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#1a1f2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 dark:text-white">Отчет кассиров</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Детальная статистика и экспорт</p>
        </div>
        <button onClick={exportToExcel} disabled={reportData.transactions.length === 0} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md shadow-emerald-500/20">
          <Download size={16} /> Скачать Excel
        </button>
      </div>

      {/* ФИЛЬТРЫ */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 dark:bg-black/20 p-5 rounded-2xl border border-slate-100 dark:border-white/5 items-end">
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Calendar size={12}/> От даты</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Calendar size={12}/> До даты</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><MapPin size={12}/> Колонка</label>
          <select value={selectedStation} onChange={(e) => setSelectedStation(e.target.value)} className={inputClass}>
            <option value="all">Все колонки</option>
            {stations.map(s => (
              <option key={s.id} value={s.id}>{s.name} {s.serial_number ? `(${s.serial_number})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><User size={12}/> Кассир</label>
          <select value={selectedCashier} onChange={(e) => setSelectedCashier(e.target.value)} className={inputClass}>
             <option value="all">Все кассиры</option>
             {cashiers.map(c => (
               <option key={c.id} value={c.username}>{c.username}</option>
             ))}
          </select>
        </div>
        <div>
          <button 
            onClick={fetchReport} 
            disabled={isLoading}
            className="w-[150px] bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            {isLoading ? 'Загрузка...' : 'Поиск'}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden">
          <p className="text-[10px] text-slate-400 dark:text-gray-400 font-black uppercase tracking-widest mb-2">Выручка за период</p>
          <p className="text-3xl font-mono font-black text-emerald-500">{(reportData.total_revenue || 0).toFixed(2)} <span className="text-sm font-bold text-slate-400 opacity-50">TJS</span></p>
        </div>
        <div className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden">
          <p className="text-[10px] text-slate-400 dark:text-gray-400 font-black uppercase tracking-widest mb-2">Отдано энергии</p>
          <p className="text-3xl font-mono font-black text-blue-500">{(reportData.total_kwh || 0).toFixed(3)} <span className="text-sm font-bold text-slate-400 opacity-50">kWh</span></p>
        </div>
        <div className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden">
          <p className="text-[10px] text-slate-400 dark:text-gray-400 font-black uppercase tracking-widest mb-2">Всего зарядок</p>
          <p className="text-3xl font-mono font-black text-indigo-500">{reportData.operations_count || 0}</p>
        </div>
      </div>

      {/* ТАБЛИЦА */}
      <div className="bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-500 dark:text-gray-400">
            <thead className="bg-slate-50 dark:bg-black/40 text-[10px] font-black text-slate-500 dark:text-gray-500 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-5 border-b border-slate-200 dark:border-white/5">Дата и Время</th>
                <th className="px-6 py-5 border-b border-slate-200 dark:border-white/5">Колонка</th>
                <th className="px-6 py-5 border-b border-slate-200 dark:border-white/5 text-right text-emerald-600 dark:text-emerald-400">Энергия</th>
                <th className="px-6 py-5 border-b border-slate-200 dark:border-white/5 text-right text-slate-900 dark:text-white">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 dark:text-gray-500 uppercase text-xs font-black tracking-widest animate-pulse">Загрузка данных...</td></tr>
              ) : reportData.transactions.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 dark:text-gray-500 uppercase text-xs font-black tracking-widest">За выбранный период данных нет</td></tr>
              ) : (
                reportData.transactions.map((tx: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-tighter">
                      {tx.created_at ? new Date(tx.created_at).toLocaleString('ru-RU') : ''}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-700 dark:text-white">{tx.station_name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-bold">{tx.connector_name}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-blue-500">
                      {tx.consumed_kwh?.toFixed(3)} <span className="text-[9px] opacity-50">kWh</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-1 bg-slate-50 dark:bg-white/5 rounded-md font-black text-slate-900 dark:text-white font-mono text-xs border border-slate-100 dark:border-white/5">
                        {tx.amount_tjs?.toFixed(2)} <span className="text-[9px] opacity-40">TJS</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CashierReport;
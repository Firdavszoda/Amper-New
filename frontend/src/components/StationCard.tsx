import React, { useState, useEffect, useRef } from 'react';
import { Square, Zap, X, BatteryFull, Key, RotateCcw, Brush } from 'lucide-react';
import type { Station, ActiveTransaction } from '../types';
import StatusBadge from './ui/StatusBadge';
import { cn } from '../lib/utils';
import { socket } from '../lib/socket';
import { useStore } from '../store/useStore';

interface StationCardProps {
  station: Station;
  activeTransactions: ActiveTransaction[];
  onStartCharging: (connectorId: number, amount: number, isFullTank: boolean) => Promise<void> | void;
  onStopCharging: (transactionId: number, connectorId: number) => Promise<void> | void;
}

const getStatusConfig = (status: string) => {
  const s = status.toLowerCase();
  switch (s) {
    case 'available': return { label: 'Свободен', color: 'text-emerald-500' };
    case 'preparing': return { label: 'Подготовка', color: 'text-orange-500' };
    case 'charging': return { label: 'Зарядка', color: 'text-indigo-500' };
    case 'suspendedev': return { label: 'Пауза (EV)', color: 'text-yellow-500' };
    case 'suspendedevse': return { label: 'Пауза (Станция)', color: 'text-yellow-500' };
    case 'finishing': return { label: 'Завершение', color: 'text-blue-500' };
    case 'reserved': return { label: 'Резерв', color: 'text-purple-500' };
    case 'faulted': return { label: 'Ошибка', color: 'text-red-500' };
    default: return { label: 'Недоступен', color: 'text-gray-400' };
  }
};

const StationCard: React.FC<StationCardProps> = ({ station, activeTransactions, onStartCharging, onStopCharging }) => {
  const { fetchStations, fetchActiveTransactions } = useStore();
  const isOffline = station.status === 'offline' || station.status === 'faulted';
  const [resetModal, setResetModal] = useState(false);
  const [authModal, setAuthModal] = useState(false);
  const [cacheModal, setCacheModal] = useState(false);

  // --- Функции вызова API ---
  const sendOcppCommand = async (url: string, body?: any) => {
    try {
      const res = await fetch(`http://localhost:3000/api/stations/${station.serial_number}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Успех (Accepted)
        alert(`✅ УСПЕШНО: ${data.message}`);
        handleRefresh();
      } else {
        // Ошибка (Rejected, NotSupported, Тайм-аут)
        alert(`❌ ОШИБКА: ${data.error}`);
      }
    } catch (e) {
      alert('❌ КРИТИЧЕСКАЯ ОШИБКА: Сервер недоступен');
    }
  };

  const handleRefresh = async () => {
    await fetchStations();
    await fetchActiveTransactions();
  };

  return (
    <div className={cn(
      "bg-rose-50/50 dark:bg-[#1a1c23] border border-rose-100 dark:border-white/5 rounded-[2rem] p-4 shadow-sm transition-all duration-300",
      isOffline && "opacity-75 grayscale-[0.2]"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight">{station.name}</h2>
            <StatusBadge status={station.status} />
          </div>
          <p className="text-[10px] font-mono text-slate-500 dark:text-gray-500 mt-1">{station.serial_number}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setResetModal(true)} className="w-8 h-8 rounded-full border border-slate-500 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
            <RotateCcw size={14} />
          </button>
          <button onClick={() => setAuthModal(true)} className="w-8 h-8 rounded-full border border-slate-500 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
            <Key size={14} />
          </button>
          <button onClick={() => setCacheModal(true)} className="w-8 h-8 rounded-full border border-slate-500 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
            <Brush size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {station.connectors?.map((conn) => (
          <ConnectorPanel key={conn.id} connector={conn} activeTx={activeTransactions.find(t => t.connector_id === conn.id)} onStart={onStartCharging} onStop={onStopCharging} isStationOffline={isOffline} />
        ))}
      </div>

      {/* 1. Модалка ПЕРЕЗАГРУЗКИ */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1f2e] border border-white/10 p-6 rounded-xl w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-6">Выберите тип перезагрузки</h3>
            <div className="space-y-3">
              <button onClick={() => { sendOcppCommand('/reset', { type: 'Soft' }); setResetModal(false); }} className="w-full py-3 bg-[#5C5CFF] hover:bg-[#4b4be5] text-white rounded-lg font-medium transition-colors">
                Soft Reset
              </button>
              <button onClick={() => { sendOcppCommand('/reset', { type: 'Hard' }); setResetModal(false); }} className="w-full py-3 bg-[#1a1f2e] border border-red-500 text-red-500 hover:bg-red-500/10 rounded-lg font-medium transition-colors">
                Hard Reset
              </button>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setResetModal(false)} className="px-5 py-2 bg-[#1a1f2e] border border-white/10 text-white rounded-lg hover:bg-white/5 transition-colors">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Модалка ЛОКАЛЬНАЯ АВТОРИЗАЦИЯ */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1f2e] border border-white/10 p-6 rounded-xl w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-6">Локальная авторизация</h3>
            <div className="space-y-3">
              <button onClick={() => { sendOcppCommand('/local-auth', { enabled: true }); setAuthModal(false); }} className="w-full py-3 bg-[#1a1f2e] border border-red-500 text-red-500 hover:bg-red-500/10 rounded-lg font-medium transition-colors">
                Включить
              </button>
              <button onClick={() => { sendOcppCommand('/local-auth', { enabled: false }); setAuthModal(false); }} className="w-full py-3 bg-[#1a1f2e] border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 rounded-lg font-medium transition-colors">
                Отключить (рекомендуется)
              </button>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setAuthModal(false)} className="px-5 py-2 bg-[#1a1f2e] border border-white/10 text-white rounded-lg hover:bg-white/5 transition-colors">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Модалка ОЧИСТКИ КЭША */}
      {cacheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#1a1f2e] border border-white/10 p-6 rounded-xl w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Очистить кэш</h3>
            <p className="text-slate-300 mb-8 text-sm">Вы уверены, что хотите очистить кэш?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCacheModal(false)} className="px-5 py-2.5 bg-[#1a1f2e] border border-white/10 text-white rounded-lg hover:bg-white/5 transition-colors">Отмена</button>
              <button onClick={() => { sendOcppCommand('/clear-cache'); setCacheModal(false); }} className="px-5 py-2.5 bg-[#5C5CFF] hover:bg-[#4b4be5] text-white rounded-lg font-medium transition-colors">Подтвердить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

type UIState = 'idle' | 'starting' | 'charging' | 'finished';

const ConnectorPanel: React.FC<any> = ({ connector, activeTx, onStart, onStop, isStationOffline }) => {
  const [uiState, setUiState] = useState<UIState>('idle');
  const [amount, setAmount] = useState<string>('');
  const [receipt, setReceipt] = useState<any>(null);
  const [liveTime, setLiveTime] = useState<string>('00:00:00');
  const timerRef = useRef<any>(null);
  const statusConfig = getStatusConfig(connector.status);

  useEffect(() => {
    if (uiState === 'finished') return; 

    if (activeTx || connector.status === 'charging') {
      if (uiState !== 'charging') setUiState('charging');
      if (receipt === 'full_tank_confirm') setReceipt(null);
    } else if (!activeTx && uiState === 'charging') {
      const timer = setTimeout(() => {
        if (uiState === 'charging') setUiState('idle');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeTx, connector.status, uiState, receipt]);

  useEffect(() => {
    const handleCompleted = (data: any) => {
      if (data.connectorId === connector.id) {
        setReceipt({ kwh: data.final_kwh, tjs: data.final_tjs });
        setUiState('finished');
      }
    };
    socket.on('transaction_completed', handleCompleted);
    socket.on('transaction_stopped', handleCompleted);
    return () => { 
      socket.off('transaction_completed', handleCompleted);
      socket.off('transaction_stopped', handleCompleted);
    };
  }, [connector.id]);

  useEffect(() => {
    if (uiState === 'charging' && activeTx?.start_time) {
      const dbTime = activeTx.start_time.endsWith('Z') ? activeTx.start_time : activeTx.start_time + 'Z';
      const start = new Date(dbTime).getTime();
      timerRef.current = setInterval(() => {
        const diff = Math.max(0, new Date().getTime() - start);
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setLiveTime(`${h}:${m}:${s}`);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setLiveTime('00:00:00');
    }
    return () => clearInterval(timerRef.current);
  }, [uiState, activeTx]);

  const handleStartClick = async (isFull: boolean) => {
    if (isStationOffline) return;
    setUiState('starting');
    
    try {
      await onStart(connector.id, Number(amount) || 0, isFull);
      setAmount('');
      // UI state will transition to 'charging' via useEffect when activeTx arrives
    } catch (e) {
      // Revert on error
      setUiState('idle');
    }
  };

  return (
    <div className={cn(
      "relative flex flex-col w-full min-h-[200px] h-auto rounded-[1.5rem] p-4 border transition-all duration-300 overflow-hidden",
      uiState === 'charging' 
        ? "bg-indigo-50/90 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-500/20 shadow-md" 
        : "bg-white dark:bg-[#1f222b] border-slate-200 dark:border-white/5 shadow-sm"
    )}>
      <div className="flex flex-col items-center text-center w-full mb-2 shrink-0">
        <div className="flex items-center gap-2">
          {uiState === 'charging' && <span className="text-indigo-500 animate-pulse text-xs">⚡</span>}
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">{connector.name}</h4>
          
          <div className="flex gap-2 ml-2">
            {connector.status === 'admin_locked' ? (
              <button 
                onClick={async () => {
                   if (window.confirm(`Включить ручку ${connector.name}?`)) {
                     try {
                       const res = await fetch(`http://localhost:3000/api/connectors/${connector.id}/power-on`, { method: 'POST' });
                       if (!res.ok) alert('Ошибка при включении ручки');
                     } catch (e) {
                       alert('Ошибка сети при включении ручки');
                     }
                   }
                }}
                className="text-emerald-500 hover:text-emerald-700 transition-colors"
                title="Включить ручку"
              >
                <Zap size={14} />
              </button>
            ) : (
              <button 
                onClick={async () => {
                   if (window.confirm(`Отключить ручку ${connector.name}?\nЭто остановит текущую зарядку на ней.`)) {
                     try {
                       const res = await fetch(`http://localhost:3000/api/connectors/${connector.id}/emergency-stop`, { method: 'POST' });
                       if (!res.ok) alert('Ошибка при отключении ручки');
                     } catch (e) {
                       alert('Ошибка сети при отключении ручки');
                     }
                   }
                }}
                className="text-red-500 hover:text-red-700 transition-colors"
                title="Отключить ручку"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[9px] text-slate-400 font-mono tracking-widest mt-0.5">{connector.type.replace(/_/g, ' ')}</p>
      </div>

      {uiState === 'idle' && (
        <div className="flex flex-col flex-1 animate-in fade-in h-full">
          {receipt === 'full_tank_confirm' ? (
            <div className="flex flex-col items-center justify-center h-full bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-500/20">
              <h4 className="text-blue-600 dark:text-blue-400 font-black uppercase text-xs mb-1 text-center">Полный бак</h4>
              <p className="text-[9px] text-slate-500 text-center mb-3 leading-tight">Зарядка будет идти до 100%.</p>
              <div className="flex gap-2 w-full">
                <button onClick={() => setReceipt(null)} className="flex-1 py-1.5 bg-slate-200 dark:bg-white/10 rounded-lg text-[10px] font-bold text-slate-600 dark:text-white uppercase tracking-wider">Отмена</button>
                <button onClick={() => { setReceipt(null); handleStartClick(true); }} className="flex-1 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Начать</button>
              </div>
            </div>
          ) : (
            <>
              <div className="my-auto text-xs shrink-0 flex justify-center">
                 <span className={cn("font-black uppercase tracking-widest text-[11px] bg-slate-50 dark:bg-black/20 px-3 py-1 rounded-full border border-slate-100 dark:border-white/5", statusConfig.color)}>
                   {statusConfig.label}
                 </span>
              </div>

              <div className="mt-auto pt-2 shrink-0">
                <input
                  type="text" inputMode="decimal" value={amount}
                  onChange={(e) => {
                    let val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                    setAmount(val);
                  }}
                  placeholder="Сумма (TJS)" disabled={connector.status !== 'available'}
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-center text-base font-black text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 tabular-nums disabled:opacity-50 transition-colors"
                />
                
                <div className="flex gap-1 mt-1.5">
                   {[10, 20, 50, 100].map(val => (
                     <button key={val} onClick={() => setAmount(val.toString())} className="flex-1 py-1 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-md text-[10px] font-bold text-slate-600 dark:text-gray-300 transition-colors disabled:opacity-50">{val}</button>
                   ))}
                </div>

                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => handleStartClick(false)} disabled={!amount || connector.status !== 'available'} className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 dark:disabled:bg-white/5 text-white disabled:text-slate-400 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-sm">Запуск</button>
                  <button onClick={() => setReceipt('full_tank_confirm')} disabled={connector.status !== 'available'} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-100 dark:disabled:bg-white/5 text-white disabled:text-slate-400 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-sm">Полный</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {uiState === 'starting' && (
        <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in duration-300 flex-1 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
          <Zap className="w-8 h-8 text-indigo-500 animate-bounce mb-3" />
          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest animate-pulse">Запуск...</span>
        </div>
      )}

      {uiState === 'charging' && activeTx && (
        <div className="flex flex-col flex-1 animate-in fade-in h-full justify-between">
          <div className="flex justify-center items-center relative h-20 my-auto shrink-0">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-100 dark:border-indigo-900/40 flex flex-col items-center justify-center shadow-inner bg-white dark:bg-black/10">
              <div className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">{activeTx.soc || 0}%</div>
              <div className="text-[6px] text-slate-400 font-black uppercase tracking-widest">SOC</div>
            </div>
            <button onClick={() => onStop(activeTx.id, connector.id)} className="absolute right-2 bottom-0 w-10 h-10 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center text-slate-700 dark:text-white hover:text-red-500 dark:hover:text-red-400 transition-all shadow-md active:scale-90">
              <Square className="w-3 h-3" fill="currentColor" />
            </button>
          </div>

          <div className="text-center text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-2 shrink-0">
            Время: <span className="font-mono tabular-nums text-xs text-slate-900 dark:text-white ml-1">{liveTime}</span>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl p-2.5 mt-auto shrink-0 mb-1 divide-x divide-slate-200 dark:divide-white/10">
            <div className="flex flex-col items-center justify-center">
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Энергия</span>
              <div className="text-sm font-black text-slate-900 dark:text-white font-mono tabular-nums">{(activeTx.consumed_kwh || 0).toFixed(2)} <span className="text-[7px] text-slate-400 font-normal ml-0.5">kWh</span></div>
            </div>
            <div className="flex flex-col items-center justify-center pl-1">
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Сумма</span>
              <div className="text-sm font-black text-emerald-500 font-mono tabular-nums">{(activeTx.amount_tjs || 0).toFixed(2)} <span className="text-[7px] text-slate-400 font-normal ml-0.5">TJS</span></div>
            </div>
          </div>
        </div>
      )}

      {uiState === 'finished' && receipt && typeof receipt !== 'string' && (
        <div className="flex flex-col flex-1 animate-in zoom-in-95 fade-in duration-300 h-full justify-between pb-1">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-2 shrink-0">
              <BatteryFull className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">Итог сессии</h3>
            
            <div className="w-full bg-slate-50 dark:bg-black/30 rounded-xl p-2.5 mt-2 border border-slate-100 dark:border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Энергия</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-xs">{receipt.kwh?.toFixed(3)} <span className="text-[8px]">kWh</span></span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 dark:border-white/10 pt-2">
                <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Сумма</span>
                <span className="font-mono font-black text-emerald-500 text-sm">{receipt.tjs?.toFixed(2)} <span className="text-[8px]">TJS</span></span>
              </div>
            </div>
          </div>
          
          <button onClick={() => { setUiState('idle'); setReceipt(null); setAmount(''); }} className="w-full mt-2 shrink-0 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white py-2 rounded-xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
            <X className="w-3 h-3" /> Закрыть чек
          </button>
        </div>
      )}
    </div>
  );
};

export default StationCard; 
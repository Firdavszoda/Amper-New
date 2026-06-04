import React, { useState, useEffect, useRef } from 'react';
import { Square, Zap, X, BatteryFull } from 'lucide-react';
import type { Station, ActiveTransaction } from '../types';
import StatusBadge from './ui/StatusBadge';
import { cn } from '../lib/utils';
import { socket } from '../lib/socket';
import { useStore } from '../store/useStore';

interface StationCardProps {
  station: Station;
  activeTransactions: ActiveTransaction[];
  onStartCharging: (connectorId: number, amount: number, isFullTank: boolean) => void;
  onStopCharging: (transactionId: number, connectorId: number) => void;
}

const StationCard: React.FC<StationCardProps> = ({ station, activeTransactions, onStartCharging, onStopCharging }) => {
  const isOffline = station.status === 'offline' || station.status === 'faulted';

  return (
    <div className={cn(
      "bg-rose-50/50 dark:bg-[#1a1c23] border border-rose-100 dark:border-white/5 rounded-[2rem] p-6 shadow-sm transition-all duration-300",
      isOffline && "opacity-75 grayscale-[0.2]"
    )}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight">{station.name}</h2>
          <p className="text-xs font-mono text-slate-500 dark:text-gray-500 mt-1">{station.serial_number}</p>
        </div>
        <div className="flex gap-2">
           <button className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">⟳</button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6 relative">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent"></div>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Статус зарядника</span>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent"></div>
      </div>

      <div className="bg-white dark:bg-black/20 rounded-2xl p-4 flex justify-between items-center mb-8 border border-slate-100 dark:border-white/5">
         <div>
           <div className="text-sm text-slate-900 dark:text-white"><span className="text-slate-500">Мощность:</span> <span className="font-black font-mono">160 kW</span></div>
           <div className="text-xs text-slate-500 mt-1">Время в сети: <span className="font-mono">{new Date().toLocaleDateString()}</span></div>
         </div>
         <StatusBadge status={station.status} />
      </div>

      <div className="flex items-center gap-4 mb-6 relative">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent"></div>
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Статус коннектора</span>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {station.connectors?.map((conn) => (
          <ConnectorPanel key={conn.id} connector={conn} activeTx={activeTransactions.find(t => t.connector_id === conn.id)} onStart={onStartCharging} onStop={onStopCharging} isStationOffline={isOffline} />
        ))}
      </div>
    </div>
  );
};

/* --- CONNECTOR PANEL (STATE MACHINE) --- */

type UIState = 'idle' | 'starting' | 'charging' | 'finished';

const ConnectorPanel: React.FC<any> = ({ connector, activeTx, onStart, onStop, isStationOffline }) => {
  const { pricePerKwh } = useStore();
  const [uiState, setUiState] = useState<UIState>('idle');
  const [amount, setAmount] = useState<string>('');
  const [receipt, setReceipt] = useState<any>(null);
  const [liveTime, setLiveTime] = useState<string>('00:00:00');
  const timerRef = useRef<any>(null);

  // 1. Старт зарядки
  useEffect(() => {
    if (activeTx && uiState !== 'charging' && uiState !== 'finished') {
      setUiState('charging');
      setReceipt(null);
    }
  }, [activeTx, uiState]);

  // 2. Ловим итоговый чек по сокету (ЖЕЛЕЗОБЕТОННО)
  useEffect(() => {
    const handleCompleted = (data: any) => {
      if (connector.id === data.connectorId) {
        setReceipt({ kwh: data.final_kwh, tjs: data.final_tjs });
        setUiState('finished');
      }
    };
    socket.on('transaction_completed', handleCompleted);
    return () => { socket.off('transaction_completed', handleCompleted); };
  }, [connector.id]);

  // 3. Сброс, если транзакция зависла (защита от багов)
  useEffect(() => {
    let timeout: any;
    if (!activeTx && uiState === 'charging') {
      timeout = setTimeout(() => {
        setUiState(prev => prev === 'charging' ? 'idle' : prev);
      }, 4000);
    }
    return () => clearTimeout(timeout);
  }, [activeTx, uiState]);

  // 4. Живой таймер
  useEffect(() => {
    if (uiState === 'charging' && activeTx?.start_time) {
      const start = new Date(activeTx.start_time).getTime();
      timerRef.current = setInterval(() => {
        const now = new Date().getTime();
        const diff = Math.max(0, now - start);
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setLiveTime(`${h}:${m}:${s}`);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      if (liveTime !== '00:00:00') {
        const timer = setTimeout(() => setLiveTime('00:00:00'), 0);
        return () => clearTimeout(timer);
      }
    }
    return () => clearInterval(timerRef.current);
  }, [uiState, activeTx, liveTime]);

  const handleStartClick = (isFull: boolean) => {
    if (isStationOffline) return;
    setUiState('starting');
    onStart(connector.id, Number(amount) || 0, isFull);
    setAmount('');
  };

  const handleStopClick = () => {
    if (!activeTx) return;
    onStop(activeTx.id, connector.id);
  };

  const closeReceipt = () => {
    setUiState('idle');
    setReceipt(null);
    setAmount('');
  };

  return (
    <div className={cn(
      "relative flex flex-col w-full h-[360px] rounded-[1.75rem] p-5 border transition-all duration-300 overflow-hidden",
      uiState === 'charging' 
        ? "bg-indigo-50/90 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-500/20 shadow-md" 
        : "bg-white dark:bg-[#1f222b] border-slate-200 dark:border-white/5 shadow-sm"
    )}>
      
      {/* ИНФОРМАЦИОННАЯ ШАПКА */}
      <div className="flex flex-col items-center text-center w-full mb-3 shrink-0">
        <div className="flex items-center gap-2">
          {uiState === 'charging' && <span className="text-indigo-500 animate-pulse text-xs">⚡</span>}
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">{connector.name}</h4>
        </div>
        <p className="text-[9px] text-slate-400 font-mono tracking-widest mt-0.5">{connector.type.replace(/_/g, ' ')}</p>
      </div>

      {/* СОСТОЯНИЕ 1: IDLE */}
      {uiState === 'idle' && (
        <div className="flex flex-col flex-1 animate-in fade-in h-full">
          {receipt === 'full_tank_confirm' ? (
            <div className="flex flex-col items-center justify-center h-full bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-500/20">
              <h4 className="text-blue-600 dark:text-blue-400 font-black uppercase text-xs mb-2 text-center">Полный бак</h4>
              <p className="text-[10px] text-slate-500 text-center mb-4 leading-tight">Зарядка будет идти до 100% или до ручной остановки.</p>
              <div className="flex gap-2 w-full">
                <button onClick={() => setReceipt(null)} className="flex-1 py-2 bg-slate-200 dark:bg-white/10 rounded-xl text-[10px] font-bold text-slate-600 dark:text-white uppercase tracking-wider">Отмена</button>
                <button onClick={() => { setReceipt(null); handleStartClick(true); }} className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">Начать</button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2.5 my-auto text-xs shrink-0">
                 <div className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                   <span className="text-slate-400 font-medium">Статус:</span>
                   <span className={cn("font-black uppercase tracking-widest text-[10px]", connector.status === 'available' ? "text-emerald-500" : "text-gray-400")}>
                     {connector.status === 'available' ? 'Свободен' : 'Недоступен'}
                   </span>
                 </div>
                 <div className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                   <span className="text-slate-400 font-medium">Мощность:</span>
                   <span className="font-bold font-mono text-slate-800 dark:text-gray-300">{connector.max_power_kw} kW</span>
                 </div>
              </div>

              <div className="mt-auto pt-3 shrink-0">
                <input
                  type="text" inputMode="decimal" value={amount}
                  onChange={(e) => {
                    let val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                    setAmount(val);
                  }}
                  placeholder="Сумма (TJS)" disabled={connector.status !== 'available'}
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-center text-lg font-black text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 tabular-nums disabled:opacity-50 transition-colors"
                />
                
                <div className="flex gap-1.5 mt-2">
                   {[10, 20, 50, 100].map(val => (
                     <button 
                       key={val} 
                       onClick={() => setAmount(val.toString())} 
                       className="flex-1 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-600 dark:text-gray-300 transition-colors disabled:opacity-50"
                     >
                       {val}
                     </button>
                   ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleStartClick(false)} disabled={!amount || connector.status !== 'available'} className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 dark:disabled:bg-white/5 text-white disabled:text-slate-400 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-sm">
                    Запустить
                  </button>
                  <button onClick={() => setReceipt('full_tank_confirm')} disabled={connector.status !== 'available'} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-100 dark:disabled:bg-white/5 text-white disabled:text-slate-400 py-2.5 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-sm">
                    Полный бак
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* СОСТОЯНИЕ 2: STARTING */}
      {uiState === 'starting' && (
        <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in duration-300 flex-1 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
          <Zap className="w-8 h-8 text-indigo-500 animate-bounce mb-3" />
          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest animate-pulse">Запуск...</span>
        </div>
      )}

      {/* СОСТОЯНИЕ 3: CHARGING */}
      {uiState === 'charging' && activeTx && (
        <div className="flex flex-col flex-1 animate-in fade-in h-full justify-between">
          <div className="flex justify-center items-center relative h-24 my-auto shrink-0">
            <div className="w-20 h-20 rounded-full border-4 border-indigo-100 dark:border-indigo-900/40 flex flex-col items-center justify-center shadow-inner bg-white dark:bg-black/10">
              <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">{activeTx.soc || 0}%</div>
              <div className="text-[7px] text-slate-400 font-black uppercase tracking-widest">SOC</div>
            </div>
            <button onClick={handleStopClick} className="absolute right-4 bottom-0 w-11 h-11 bg-white dark:bg-[#1a1c23] border border-slate-200 dark:border-white/10 rounded-full flex items-center justify-center text-slate-700 dark:text-white hover:text-red-500 dark:hover:text-red-400 transition-all shadow-md active:scale-90">
              <Square className="w-4 h-4" fill="currentColor" />
            </button>
          </div>

          <div className="text-center text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2 shrink-0">
            Время: <span className="font-mono tabular-nums text-sm text-slate-900 dark:text-white ml-1">{liveTime}</span>
          </div>

          <div className="grid grid-cols-3 border-t border-slate-200 dark:border-white/10 pt-3 mt-auto divide-x divide-slate-200 dark:divide-white/10 text-center bg-white/50 dark:bg-black/10 rounded-xl p-2 shrink-0 mb-1">
            <div className="flex flex-col items-center justify-center">
              <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider mb-1">Энергия</span>
              <div className="text-xs font-black text-emerald-500 font-mono tabular-nums">{(activeTx.consumed_kwh || 0).toFixed(2)} <span className="text-[7px] text-slate-400 font-normal">kWh</span></div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider mb-1">Сумма</span>
              <div className="text-xs font-black text-slate-900 dark:text-white font-mono tabular-nums">{(activeTx.amount_tjs || 0).toFixed(2)} <span className="text-[7px] text-slate-400 font-normal">TJS</span></div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider mb-1">Тариф</span>
              <div className="text-xs font-black text-indigo-500 font-mono tabular-nums">{(activeTx.price_per_kwh || pricePerKwh).toFixed(1)} <span className="text-[7px] text-slate-400 font-normal">TJS</span></div>
            </div>
          </div>
        </div>
      )}

      {/* СОСТОЯНИЕ 4: FINISHED (ЧЕК) */}
      {uiState === 'finished' && receipt && typeof receipt !== 'string' && (
        <div className="flex flex-col flex-1 animate-in zoom-in-95 fade-in duration-300 h-full justify-between pb-1">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-3 shrink-0">
              <BatteryFull className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">Итог сессии</h3>
            
            <div className="w-full bg-slate-50 dark:bg-black/30 rounded-xl p-3 mt-3 border border-slate-100 dark:border-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Энергия</span>
                <span className="font-mono font-black text-emerald-500 text-sm">{receipt.kwh?.toFixed(3)} <span className="text-[10px]">kWh</span></span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 dark:border-white/10 pt-3">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Сумма</span>
                <span className="font-mono font-black text-slate-900 dark:text-white text-base">{receipt.tjs?.toFixed(2)} <span className="text-[10px]">TJS</span></span>
              </div>
            </div>
          </div>
          
          <button onClick={closeReceipt} className="w-full mt-3 shrink-0 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95">
            <X className="w-4 h-4" /> Закрыть чек
          </button>
        </div>
      )}
    </div>
  );
};

export default StationCard;
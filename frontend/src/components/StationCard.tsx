import React, { useState } from 'react';
import { BatteryFull, Play, X } from 'lucide-react';
import type { Station, ActiveTransaction } from '../types';
import StatusBadge from './ui/StatusBadge';
import { cn } from '../lib/utils';

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
      "bg-[#121621] border border-white/5 rounded-3xl p-6 shadow-2xl transition-all duration-300",
      isOffline && "opacity-60"
    )}>
      {/* HEADER */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tight">{station.name}</h3>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-1">SN: {station.serial_number}</p>
        </div>
        <StatusBadge status={station.status} />
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {station.connectors?.map((conn) => (
          <ConnectorPanel 
            key={conn.id} 
            connector={conn} 
            activeTx={activeTransactions.find(t => t.connector_id === conn.id)}
            onStart={onStartCharging}
            onStop={onStopCharging}
          />
        ))}
      </div>
    </div>
  );
};

/* --- CONNECTOR PANEL --- */

const ConnectorPanel: React.FC<any> = ({ connector, activeTx, onStart, onStop }) => {
  const [amount, setAmount] = useState<string>('');
  const [isFullTankModalOpen, setIsFullTankModalOpen] = useState(false);
  const [pendingFullTankData, setPendingFullTankData] = useState<{ connectorId: number } | null>(null);
  const [summaryModalData, setSummaryModalData] = useState<{tjs: number, kwh: number} | null>(null);

  const isCharging = connector.status === 'charging' && activeTx;

  const openFullTankModal = (connectorId: number) => {
    setPendingFullTankData({ connectorId });
    setIsFullTankModalOpen(true);
  };

  const handleStartClick = (connectorId: number, amt: number, isFullTank: boolean) => {
    onStart(connectorId, amt, isFullTank);
    setAmount('');
  };

  const confirmFullTankCharge = () => {
    if (pendingFullTankData) {
      handleStartClick(pendingFullTankData.connectorId, 0, true);
    }
    setIsFullTankModalOpen(false);
    setPendingFullTankData(null);
  };

  const handleStopClick = () => {
    // 1. Показываем чек с финальными данными из активной транзакции
    setSummaryModalData({
      tjs: activeTx?.amount_tjs || 0,
      kwh: activeTx?.consumed_kwh || 0
    });
    
    // 2. Отправляем команду стоп
    if (activeTx) {
      onStop(activeTx.id, connector.id);
    }
    
    // 3. Очищаем поле ввода суммы
    setAmount(''); 
  };

  return (
    <div className={cn(
      "min-h-[280px] rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between",
      isCharging 
        ? "bg-blue-600/5 border-blue-500/20" 
        : "bg-[#1e2536] border-white/5"
    )}>
      {/* Info Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{connector.name}</p>
          <p className="text-[10px] font-mono text-gray-500 uppercase">{connector.type.replace(/_/g, ' ')}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-500 uppercase font-bold">Limit</p>
          <p className="text-xs font-black text-gray-300 font-mono">{connector.max_power_kw} kW</p>
        </div>
      </div>

      {isCharging ? (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
              <p className="text-[8px] text-gray-500 uppercase font-bold mb-1">Energy</p>
              <p className="text-sm font-mono font-bold text-white">{activeTx.consumed_kwh.toFixed(2)}</p>
            </div>
            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
              <p className="text-[8px] text-gray-500 uppercase font-bold mb-1">Time</p>
              <p className="text-sm font-mono font-bold text-white">05:00</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between bg-blue-600/10 p-3 rounded-xl border border-blue-500/20">
            <div className="pl-2">
              <p className="text-[8px] text-blue-300 uppercase font-bold mb-0.5">Total</p>
              <p className="text-2xl font-mono font-black text-white leading-none">
                {activeTx.amount_tjs.toFixed(2)} <span className="text-[10px] opacity-50 font-sans">TJS</span>
              </p>
            </div>
            
            {/* ИСПРАВЛЕННАЯ КНОПКА СТОП */}
            <button 
              onClick={handleStopClick} 
              className="flex ml-[5px] items-center justify-center w-12 h-12 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-all outline-none focus:outline-none focus:ring-0 active:scale-95 shadow-lg hover:shadow-red-500/30"
            >
              <X className="w-5 h-5 stroke-[3] " />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <input 
              type="number"
              placeholder="0.00"
              value={amount}
              min="0"
              step="any"
              onKeyDown={(e) => {
                if (e.key === '-' || e.key === 'e') {
                  e.preventDefault();
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || Number(val) >= 0) {
                  setAmount(val);
                }
              }}
              className="w-full bg-[#121621] border border-white/5 rounded-xl px-4 py-4 text-white font-mono text-xl placeholder:text-gray-700 focus:outline-none focus:border-blue-500 transition-colors [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
            />
            <span className="absolute right-4 top-5 text-gray-500 text-[10px] font-bold uppercase">TJS</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleStartClick(connector.id, Number(amount), false)}
              disabled={!amount || Number(amount) <= 0}
              className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-emerald-900/20 outline-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 disabled:active:scale-100"
            >
              <Play className="w-6 h-6 fill-white" />
            </button>
            <button 
              onClick={() => openFullTankModal(connector.id)}
              className="h-14 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all outline-none focus:outline-none"
            >
              <BatteryFull className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения "До полного" */}
      {isFullTankModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Подтверждение</h3>
            <p className="text-sm text-gray-400 mb-8">Запустить зарядку до полного бака без лимита суммы?</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsFullTankModalOpen(false)}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase text-xs transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={confirmFullTankCharge}
                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase text-xs shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
              >
                Да, начать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно "Итог зарядки" (Чек) */}
      {summaryModalData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-[#1a1f2e] border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-6">Зарядка завершена</h3>
            
            <div className="space-y-4 mb-8 text-left bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Потреблено:</span>
                <span className="text-white font-bold text-lg">{summaryModalData.kwh.toFixed(2)} kWh</span>
              </div>
              <div className="h-px w-full bg-white/10"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">К оплате:</span>
                <span className="text-emerald-400 font-black text-2xl">{summaryModalData.tjs.toFixed(2)} TJS</span>
              </div>
            </div>

            <button
              onClick={() => setSummaryModalData(null)}
              className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold uppercase text-sm transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StationCard;
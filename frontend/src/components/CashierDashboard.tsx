import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import StationCard from './StationCard';

const CashierDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    stations, 
    activeTransactions, 
    currentShift, 
    fetchStations, 
    startCharging, 
    stopCharging, 
    initSocket,
    openShift,
    checkShift
  } = useStore();

  const [isOpening, setIsOpening] = useState(false);

  // Инициализация сокетов
  useEffect(() => {
    initSocket();
  }, [initSocket]);

  // Проверка статуса смены при загрузке
  useEffect(() => {
    if (user) {
      checkShift(user.id);
    }
  }, [user, checkShift]);

  const handleStartCharging = (connectorId: number, amount: number, isFullTank: boolean) => {
    if (currentShift) {
      startCharging(connectorId, amount, isFullTank, currentShift.id);
    }
  };

  // Если смена НЕ открыта — показываем экран блокировки
  if (!currentShift) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="max-w-md w-full bg-[#1a1f2e] border border-white/10 rounded-[2rem] p-10 text-center shadow-2xl relative overflow-hidden">
          {/* Декоративное свечение */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-500/20 blur-[50px] pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            
            <h2 className="text-2xl font-black text-white mb-3 uppercase tracking-widest">Доступ закрыт</h2>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed font-medium">
              Привет, <span className="text-emerald-400">{user?.username}</span>! Чтобы начать управлять станциями и принимать платежи, необходимо открыть кассовую смену.
            </p>
            
            <button 
              onClick={async () => {
                setIsOpening(true);
                try { await openShift(user?.id); } catch(e) { console.error(e); } finally { setIsOpening(false); }
              }}
              disabled={isOpening}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isOpening ? 'Открытие...' : 'Открыть смену'}
              {!isOpening && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Если смена ОТКРЫТА — код рендера станций
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121621] transition-colors duration-300">
      <main className="max-w-7xl mx-auto p-6 pt-8">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 mb-6 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            <h2 className="text-sm font-bold uppercase tracking-widest">Станции</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {stations.map(station => (
              <StationCard
                key={station.id}
                station={station}
                activeTransactions={activeTransactions}
                onStartCharging={handleStartCharging}
                onStopCharging={stopCharging}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default CashierDashboard;
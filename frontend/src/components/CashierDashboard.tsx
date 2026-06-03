import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';
import StationCard from './StationCard';
import { LayoutGrid, Power, Clock } from 'lucide-react';

const CashierDashboard: React.FC = () => {
  const { user } = useAuthStore();
  
  // ИСПРАВЛЕНО: Добавили initSocket сюда!
  const { stations, activeTransactions, fetchStations, startCharging, stopCharging, initSocket } = useStore();

  const [currentShift, setCurrentShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ИСПРАВЛЕНО: Включаем прослушку сокетов при загрузке страницы!
  useEffect(() => {
    initSocket();
  }, [initSocket]);

  // Проверка статуса смены на бэкенде
  useEffect(() => {
    const checkShift = async () => {
      if (user) {
        try {
          const response = await fetch(`http://localhost:3000/api/shifts/current/${user.id}`);
          const data = await response.json();
          setCurrentShift(data);
          // Если смена открыта, загружаем станции
          if (data && data.status === 'open') {
            await fetchStations();
          }
        } catch (error) {
          console.warn('Бэкенд недоступен или ошибка при проверке смены.');
        } finally {
          setLoading(false);
        }
      }
    };
    checkShift();
  }, [user, fetchStations]);

  const openShift = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCurrentShift(data);
      // После открытия смены загружаем станции
      await fetchStations();
    } catch (error) {
      alert('Ошибка открытия смены');
    }
  };

  const handleStartCharging = (connectorId: number, amount: number, isFullTank: boolean) => {
    if (currentShift) {
      startCharging(connectorId, amount, isFullTank, currentShift.id);
    }
  };

  const closeShift = async () => {
    if (!currentShift) return;
    try {
      const res = await fetch('http://localhost:3000/api/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: currentShift.id })
      });
      const data = await res.json();
      alert(`Смена завершена! Выручка за период: ${data.revenue} TJS`);
      setCurrentShift(null);
    } catch (error) {
      alert('Ошибка закрытия смены');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-black text-gray-400 dark:text-app-muted animate-pulse bg-gray-50 dark:bg-app-bg">
        ЗАГРУЗКА ДАННЫХ КАССЫ...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-app-bg transition-colors duration-300">
      {/* HEADER */}
      <header className="bg-white dark:bg-app-card border-b border-gray-100 dark:border-app-border p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
              Рабочее место кассира
            </h1>
            {currentShift && (
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase shadow-sm border border-emerald-500/20">
                Смена #{currentShift.id || 'АКТИВНА'} открыта
              </span>
            )}
          </div>

          {currentShift && (
            <button
              onClick={closeShift}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-red-500/20 active:scale-95"
            >
              <Power className="w-4 h-4" />
              Завершить смену
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {!currentShift ? (
          /* ЭКРАН ЗАКРЫТОЙ СМЕНЫ */
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white dark:bg-app-card p-10 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-app-border text-center space-y-6 max-w-lg w-full relative overflow-hidden">
              <div className="inline-flex p-6 bg-gray-50 dark:bg-app-bg rounded-full relative z-10 border border-gray-100 dark:border-app-border">
                <Clock className="w-12 h-12 text-gray-400 dark:text-app-muted" />
              </div>
              <div className="space-y-2 relative z-10">
                <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Смена закрыта</h2>
                <p className="text-gray-500 dark:text-app-muted font-bold text-sm uppercase">Для начала работы необходимо открыть кассу</p>
              </div>

              <button
                onClick={openShift}
                className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xl uppercase shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98] relative z-10"
              >
                Открыть смену
              </button>
            </div>
          </div>
        ) : (
          /* ЭКРАН РАБОТЫ (СТАНЦИИ) */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-2">
              <LayoutGrid className="w-5 h-5 text-gray-400" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Станции</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {stations.map(station => (
                <StationCard
                  key={station.id}
                  station={station}
                  // Передаем правильные данные и функции для новых ручек
                  activeTransactions={activeTransactions}
                  onStartCharging={handleStartCharging}
                  onStopCharging={stopCharging}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default CashierDashboard;
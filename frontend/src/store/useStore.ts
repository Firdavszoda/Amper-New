import { create } from 'zustand';
import { socket } from '../lib/socket';
import type { Station, ActiveTransaction } from '../types';
import { api } from '../services/api';

interface AppState {
  stations: Station[];
  activeTransactions: ActiveTransaction[];
  currentShift: any | null;
  isLoading: boolean;
  error: string | null;
  pricePerKwh: number;

  fetchPrice: () => Promise<void>;
  fetchStations: () => Promise<void>;
  startCharging: (connectorId: number, amount: number, isFullTank: boolean, shiftId: number) => Promise<void>;
  stopCharging: (transactionId: number, connectorId: number) => Promise<void>;
  initSocket: () => void;
  setError: (error: string | null) => void;
  setCurrentShift: (shift: any | null) => void;
  checkShift: (userId: number) => Promise<void>;
  openShift: (userId: number) => Promise<void>;
  closeShift: (shiftId: number) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  stations: [],
  activeTransactions: [],
  currentShift: null,
  isLoading: false,
  error: null,
  pricePerKwh: 3.6,

  setError: (error) => set({ error }),
  setCurrentShift: (shift) => set({ currentShift: shift }),

  fetchPrice: async () => {
    try {
      const data = await api.getPrice();
      set({ pricePerKwh: data.price_per_kwh });
    } catch (error) {
      console.warn('Ошибка при загрузке тарифа', error);
    }
  },

  checkShift: async (userId) => {
    try {
      const shift = await api.getCurrentShift(userId);
      set({ currentShift: shift });
      if (shift && shift.status === 'open') {
        await get().fetchStations();
      }
    } catch (error) {
      console.warn('Ошибка при проверке смены', error);
    }
  },

  openShift: async (userId) => {
    try {
      const shift = await api.openShift(userId);
      set({ currentShift: shift });
      await get().fetchStations();
    } catch (error: any) {
      alert(error.message || 'Ошибка открытия смены');
    }
  },

  closeShift: async (shiftId: number) => {
    try {
      const response = await api.closeShift(shiftId);
      set({ currentShift: null });
      return response;
    } catch (error) {
      console.error('Ошибка закрытия смены', error);
      throw error;
    }
  },

  initSocket: () => {
    socket.off('charging_update');
    socket.off('station_status_update');
    socket.off('price_updated');
    socket.off('transaction_completed');
    
    socket.on('connect', () => console.log('Socket connected'));

    socket.on('price_updated', (data) => {
      set({ pricePerKwh: data.price_per_kwh });
    });

    socket.on('station_status_update', () => {
      get().fetchStations();
    });

    socket.on('charging_update', () => {
      get().fetchStations();
    });

    socket.on('transaction_completed', () => {
      get().fetchStations();
    });
  },

  fetchStations: async () => {
    set({ isLoading: true, error: null });
    try {
      const [stationsData, activeData] = await Promise.all([
        api.getStations(),
        api.getActiveTransactions()
      ]);
      
      const mappedActive: ActiveTransaction[] = activeData.map((tx: any) => ({
        id: tx.id,
        connector_id: tx.connector_id,
        consumed_kwh: tx.consumed_kwh,
        amount_tjs: tx.amount_tjs,
        is_full_tank: tx.is_full_tank === 1,
        start_time: tx.created_at
      }));

      set({ stations: stationsData, activeTransactions: mappedActive });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  startCharging: async (connectorId, amount, isFullTank, shiftId) => {
    set({ isLoading: true, error: null });
    try {
      const { transaction_id } = await api.startCharging({
        shift_id: shiftId,
        connector_id: connectorId,
        amount_tjs: amount,
        is_full_tank: isFullTank
      });

      set((state) => ({
        stations: state.stations.map(station => ({
          ...station,
          connectors: station.connectors.map(c => 
            c.id === connectorId ? { ...c, status: 'charging' } : c
          )
        })),
        activeTransactions: [
          ...state.activeTransactions,
          {
            id: transaction_id,
            connector_id: connectorId,
            amount_tjs: 0,
            consumed_kwh: 0,
            is_full_tank: isFullTank,
            start_time: new Date().toISOString()
          }
        ]
      }));
      
      get().fetchStations();
    } catch (error: any) {
      set({ error: error.message });
      alert(`Ошибка: ${error.message}`);
    } finally {
      set({ isLoading: false });
    }
  },

  stopCharging: async (transactionId, connectorId) => {
    set({ isLoading: true, error: null });
    try {
      await api.stopCharging({
        transaction_id: transactionId,
        connector_id: connectorId
      });

      set((state) => ({
        stations: state.stations.map(station => ({
          ...station,
          connectors: station.connectors.map(c => 
            c.id === connectorId ? { ...c, status: 'available' } : c
          )
        })),
        activeTransactions: state.activeTransactions.filter(t => t.id !== transactionId)
      }));
    } catch (error: any) {
      set({ error: error.message });
      alert(`Ошибка: ${error.message}`);
    } finally {
      set({ isLoading: false });
    }
  }
}));
import { create } from 'zustand';
import { io } from 'socket.io-client';
import type { Station, ActiveTransaction } from '../types';
import { api } from '../services/api';

interface AppState {
  stations: Station[];
  activeTransactions: ActiveTransaction[];
  isLoading: boolean;
  error: string | null;

  fetchStations: () => Promise<void>;
  startCharging: (connectorId: number, amount: number, isFullTank: boolean, shiftId: number) => Promise<void>;
  stopCharging: (transactionId: number, connectorId: number) => Promise<void>;
  initSocket: () => void;
  setError: (error: string | null) => void;
}

const socket = io('http://localhost:3000');

export const useStore = create<AppState>((set, get) => ({
  stations: [],
  activeTransactions: [],
  isLoading: false,
  error: null,

  setError: (error) => set({ error }),

  initSocket: () => {
    socket.off('charging_update');
    socket.on('charging_update', (data) => {
      const { transaction_id, connector_id, consumed_kwh, amount_tjs, status } = data;

      if (status === 'completed') {
        set((state) => ({
          stations: state.stations.map(s => ({
            ...s,
            connectors: s.connectors.map(c => 
              c.id === connector_id ? { ...c, status: 'available' } : c
            )
          })),
          activeTransactions: state.activeTransactions.filter(t => t.id !== transaction_id)
        }));
      } else {
        set((state) => ({
          activeTransactions: state.activeTransactions.map(t => 
            t.id === transaction_id ? { ...t, consumed_kwh, amount_tjs } : t
          )
        }));
      }
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
    
    // Optimistic UI Update (optional, but requested)
    // We'll keep it simple: wait for response to ensure we have the transaction_id
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
      
      // Шаг 3: Обновление стейта на Frontend
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

    console.log("Отправка СТОП:", { transaction_id: transactionId, connector_id: connectorId });

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

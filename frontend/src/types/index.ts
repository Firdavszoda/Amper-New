export type UserRole = 'admin' | 'cashier' | 'financier';

export interface User {
  id: number;
  username: string;
  role: UserRole;
}

export interface Connector {
  id: number;
  station_id: number;
  name: string;
  type: string;
  max_power_kw: number;
  status: 'available' | 'charging' | 'faulted';
}

export interface Station {
  id: number;
  name: string;
  serial_number: string;
  status: 'online' | 'offline' | 'faulted';
  connectors: Connector[]; 
}

export interface Transaction {
  id: number;
  station_id: number;
  amount_tjs: number;
  target_kwh: number;
  consumed_kwh: number;
  status: 'pending' | 'charging' | 'completed';
  timestamp: string;
}

export interface ActiveTransaction {
  id: number; // Идентификатор транзакции из БД
  connector_id: number;
  consumed_kwh: number;
  amount_tjs: number;
  is_full_tank: boolean;
  start_time: string;
}
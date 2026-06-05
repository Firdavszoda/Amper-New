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
  status: string;
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
  soc?: number;      // State of Charge (%)
  current_a?: number; // Ток (Амперы)
  voltage_v?: number; // Напряжение (Вольты)
  power_kw?: number;  // Мощность (Киловатты)
  price_per_kwh?: number; // Текущий тариф
}
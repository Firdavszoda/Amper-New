import type { Station } from '../types';

const API_BASE_URL = 'http://localhost:3000/api';

class ApiError extends Error {
  public status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(errorData.error || `Request failed with status ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Network error: Please check your connection');
  }
}

export const api = {
  // Stations
  getStations: () => request<Station[]>('/stations'),
  
  // Transactions
  startCharging: (data: { shift_id: number; connector_id: number; amount_tjs: number; is_full_tank: boolean }) => 
    request<{ transaction_id: number }>('/transactions/start', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  stopCharging: (data: { transaction_id: number; connector_id: number }) => 
    request<{ success: boolean }>('/transactions/stop', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getActiveTransactions: () => request<any[]>('/transactions/active'),

  // Admin & Analytics
  createStation: (station: any) => request<any>('/stations', { method: 'POST', body: JSON.stringify(station) }),
  updateStation: (id: number, data: any) => request<{ success: boolean }>(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStation: (id: number) => request<{ success: boolean }>(`/stations/${id}`, { method: 'DELETE' }),
  getAnalytics: () => request<any>('/admin/dashboard'),
  getUsers: () => request<any[]>('/admin/users'),
  addUser: (user: any) => request<any>('/admin/users', { method: 'POST', body: JSON.stringify(user) }),
  deleteUser: (id: number) => request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
  updateStationStatus: (id: number, status: string) => 
    request<{ success: boolean }>(`/admin/stations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
    
  // Shifts
  getCurrentShift: (userId: number) => request<any>(`/shifts/current/${userId}`),
  openShift: (userId: number) => request<any>('/shifts/open', { method: 'POST', body: JSON.stringify({ userId }) }),
  closeShift: (shiftId: number) => request<any>('/shifts/close', { method: 'POST', body: JSON.stringify({ shiftId }) }),
};

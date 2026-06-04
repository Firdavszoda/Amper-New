import React, { useState } from 'react';
import { LayoutGrid, Power, Edit, Trash2, Plus, X, ServerOff } from 'lucide-react';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import Button from './ui/Button';

const AdminStationManager: React.FC = () => {
  const { stations, fetchStations } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stationForm, setStationForm] = useState({
    name: '',
    serial_number: '',
    connectorsCount: 2
  });

  const toggleStation = async (id: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'online' ? 'offline' : 'online';
      await api.updateStationStatus(id, newStatus);
      fetchStations();
    } catch (error: any) {
      alert(error.message || "Не удалось изменить статус станции");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Вы уверены, что хотите удалить эту станцию? Все коннекторы будут также удалены.")) return;
    try {
      await api.deleteStation(id);
      fetchStations();
    } catch (error: any) {
      alert(error.message || "Ошибка при удалении станции");
    }
  };

  const handleOpenEdit = (station: any) => {
    setStationForm({
      name: station.name,
      serial_number: station.serial_number,
      connectorsCount: station.connectors?.length || 2
    });
    setEditingId(station.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setStationForm({ name: '', serial_number: '', connectorsCount: 2 });
    setIsEditMode(false);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isEditMode && editingId) {
        await api.updateStation(editingId, { name: stationForm.name });
      } else {
        const connectors = Array.from({ length: stationForm.connectorsCount }).map((_, i) => ({
          name: `${i + 1}-Ручка-${String.fromCharCode(65 + i)}`,
          type: 'GB_T_DC',
          max_power_kw: 120
        }));

        await api.createStation({
          name: stationForm.name,
          serial_number: stationForm.serial_number,
          connectors
        });
      }

      setIsModalOpen(false);
      setStationForm({ name: '', serial_number: '', connectorsCount: 2 });
      fetchStations();
    } catch (error: any) {
      alert(error.message || "Ошибка сохранения");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Оборудование</h2>
          <p className="text-[10px] text-gray-400 dark:text-app-muted font-bold uppercase tracking-widest text-emerald-500">Мониторинг и управление</p>
        </div>
        <Button 
          variant="primary" 
          onClick={handleOpenAdd}
          icon={<Plus className="w-4 h-4" />}
        >
          Добавить станцию
        </Button>
      </div>

      <div className="bg-white dark:bg-app-card rounded-[2.5rem] border border-gray-100 dark:border-app-border overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-app-bg text-gray-400 dark:text-app-muted uppercase text-[10px] font-black tracking-widest border-b border-gray-100 dark:border-app-border">
            <tr>
              <th className="p-6">Название колонки</th>
              <th className="p-6">Серийный номер</th>
              <th className="p-6 text-center">Коннекторы</th>
              <th className="p-6 text-center">Статус</th>
              <th className="p-6 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-app-border">
            {stations.map(s => (
              <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-all group">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${s.status === 'online' ? 'bg-emerald-50 text-emerald-500 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-red-50 text-red-500 border-red-100 dark:bg-red-500/10 dark:border-red-500/20'}`}>
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <span className="font-black text-gray-900 dark:text-white uppercase text-sm">{s.name}</span>
                  </div>
                </td>
                <td className="p-6 font-mono text-xs text-gray-400 dark:text-app-muted font-bold tracking-tight">{s.serial_number}</td>
                <td className="p-6 text-center font-black text-sm text-gray-900 dark:text-white">
                  {s.connectors?.length || 0}
                </td>
                <td className="p-6 text-center">
                  <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight ${s.status === 'online' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-400 text-white'}`}>
                    {s.status === 'online' ? 'В сети' : 'Оффлайн'}
                  </span>
                </td>
                <td className="p-6 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => toggleStation(s.id, s.status)} className={`p-2.5 rounded-xl border transition-all ${s.status === 'online' ? 'text-red-500 border-red-100 dark:border-red-500/20 hover:bg-red-500 hover:text-white' : 'text-emerald-500 border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-500 hover:text-white'}`} title="Переключить питание">
                      <Power className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleOpenEdit(s)} className="p-2.5 text-blue-500 border border-blue-100 dark:border-blue-500/20 hover:bg-blue-500 hover:text-white rounded-xl transition-all" title="Редактировать">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-2.5 text-red-500 border border-red-100 dark:border-red-500/20 hover:bg-red-500 hover:text-white rounded-xl transition-all" title="Удалить">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            
            {stations.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-full mb-4 border border-gray-100 dark:border-white/5">
                      <ServerOff className="w-8 h-8 text-gray-400 dark:text-app-muted" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-2">Станций не найдено</h3>
                    <p className="text-xs text-gray-500 dark:text-app-muted font-bold uppercase tracking-widest max-w-sm mb-6">В системе пока нет зарегистрированного оборудования. Добавьте первую зарядную станцию.</p>
                    <Button variant="outline" onClick={handleOpenAdd} icon={<Plus className="w-4 h-4" />}>
                      Добавить станцию
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-app-card rounded-[3rem] p-10 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 relative border border-gray-100 dark:border-app-border">
            <button onClick={() => setIsModalOpen(false)} className="absolute right-6 top-6 p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-8">
              {isEditMode ? 'Редактировать' : 'Новая станция'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 dark:text-app-muted uppercase ml-2 tracking-widest">Название станции</label>
                <input 
                  type="text" 
                  placeholder="Например: Станция #5" 
                  required
                  className="w-full bg-gray-50 dark:bg-app-bg border border-gray-100 dark:border-app-border p-4 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:text-white font-bold transition-all"
                  value={stationForm.name}
                  onChange={e => setStationForm({...stationForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 dark:text-app-muted uppercase ml-2 tracking-widest">Серийный номер</label>
                <input 
                  type="text" 
                  placeholder="SN-XXXX-XXXX" 
                  required
                  disabled={isEditMode}
                  className="w-full bg-gray-50 dark:bg-app-bg border border-gray-100 dark:border-app-border p-4 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:text-white font-mono transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                  value={stationForm.serial_number}
                  onChange={e => setStationForm({...stationForm, serial_number: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 dark:text-app-muted uppercase ml-2 tracking-widest">Количество коннекторов</label>
                <input 
                  type="number" 
                  min="1" 
                  max="4" 
                  required
                  disabled={isEditMode}
                  className="w-full bg-gray-50 dark:bg-app-bg border border-gray-100 dark:border-app-border p-4 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 dark:text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  value={stationForm.connectorsCount}
                  onChange={e => setStationForm({...stationForm, connectorsCount: parseInt(e.target.value)})}
                />
              </div>
              <div className="pt-4">
                <Button type="submit" variant="secondary" className="w-full" isLoading={isLoading}>
                  {isEditMode ? 'Сохранить изменения' : 'Добавить оборудование'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStationManager;
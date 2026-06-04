import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, Users, LayoutGrid, TrendingUp, 
  UserPlus, Trash2, ShieldCheck, Activity, X, BarChart3, 
  Zap, Signal, LogOut
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

import { api } from '../services/api';
import AdminStationManager from './AdminStationManager';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'hardware' | 'security'>('overview');
  const { fetchStations } = useStore();
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const [users, setUsers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'cashier' });
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState<number | string>('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchData(), fetchStations(), fetchPrice()]);
      setLoading(false);
    };
    init();
  }, []);

  const fetchPrice = async () => {
    try {
      const data = await api.getPrice();
      setPrice(data.price_per_kwh);
    } catch (e) {
      console.error("Ошибка загрузки тарифа:", e);
    }
  };

  const handleSavePrice = async () => {
    setIsSavingPrice(true);
    try {
      await api.updatePrice(parseFloat(price as string));
      alert('Тариф успешно обновлен во всей системе!');
    } catch (e) {
      alert('Ошибка при сохранении тарифа');
    } finally {
      setIsSavingPrice(false);
    }
  };

  const fetchData = async () => {
    try {
      const [userData, analyticsData] = await Promise.all([
        api.getUsers(),
        api.getAnalytics()
      ]);
      setUsers(userData);
      setAnalytics(analyticsData);
    } catch (e) {
      console.error("Ошибка загрузки:", e);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // --- ДЕЙСТВИЯ ---

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addUser(newUser);
      setIsModalOpen(false);
      setNewUser({ username: '', password: '', role: 'cashier' });
      fetchData();
    } catch (error: any) {
      alert(error.message || "Ошибка при создании пользователя");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Удалить сотрудника из системы навсегда?")) return;
    try {
      await api.deleteUser(id);
      fetchData();
    } catch (error: any) {
      alert(error.message || "Ошибка при удалении пользователя");
    }
  };

  // --- СТРАНИЦЫ ---

  const renderOverview = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
      
      {/* УПРАВЛЕНИЕ ТАРИФОМ */}
      <div className="bg-white dark:bg-app-card border border-gray-100 dark:border-app-border p-8 rounded-[2.5rem] shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-left">
            <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-500" /> Управление тарифом
            </h3>
            <p className="text-[10px] text-gray-400 dark:text-app-muted font-bold uppercase tracking-widest mt-1">Стоимость электроэнергии для клиентов</p>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <input 
                type="number" step="0.1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-gray-50 dark:bg-app-bg border border-gray-100 dark:border-app-border rounded-2xl px-6 py-4 text-gray-900 dark:text-white font-black text-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
              />
              <span className="absolute right-6 top-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">TJS/кВт⋅ч</span>
            </div>
            <button 
              onClick={handleSavePrice} disabled={isSavingPrice}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              {isSavingPrice ? '...' : 'Обновить'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard label="Выручка (Месяц)" value={analytics?.totalRevenue?.toFixed(2) || "0.00"} suffix="TJS" icon={<TrendingUp />} color="emerald" />
        <StatCard label="Активные сессии" value={analytics?.totalSessions || 0} icon={<Zap />} color="blue" />
        <StatCard label="Средний чек" value={analytics?.avgCheck || "0.00"} suffix="TJS" icon={<Activity />} color="amber" />
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white dark:bg-app-card rounded-[2.5rem] border border-gray-100 dark:border-app-border p-8 shadow-2xl">
          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase mb-8 flex items-center gap-3 tracking-tighter">
            <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" /> Системный журнал
          </h3>
          <SecurityTable logs={analytics?.securityLogs?.slice(0, 6)} compact />
        </div>
        
        <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-500/30">
          <div className="relative z-10 space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tighter">Состояние узла</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                <span className="text-xs font-bold uppercase opacity-70">Аптайм</span>
                <span className="font-mono font-black text-sm">99.9%</span>
              </div>
              <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                <span className="text-xs font-bold uppercase opacity-70">Задержка</span>
                <span className="font-mono font-black text-sm text-emerald-300">12мс</span>
              </div>
              <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                <span className="text-xs font-bold uppercase opacity-70">Статус API</span>
                <span className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> В сети</span>
              </div>
            </div>
          </div>
          <Signal className="absolute -right-12 -bottom-12 w-64 h-64 opacity-10 rotate-12" />
        </div>
      </div>
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="flex justify-between items-center bg-white dark:bg-app-card p-6 rounded-[2rem] border border-gray-100 dark:border-app-border shadow-xl">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Команда</h2>
          <p className="text-[10px] text-gray-400 dark:text-app-muted font-bold uppercase tracking-widest text-blue-500">Доступы и полномочия</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
          <UserPlus className="w-4 h-4" /> Добавить сотрудника
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {users.map(u => (
          <UserCard key={u.id} user={u} onDelete={() => handleDeleteUser(u.id)} />
        ))}
      </div>
    </div>
  );

  const renderHardware = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <AdminStationManager />
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="flex items-center gap-4">
        <ShieldAlert className="w-10 h-10 text-red-500" />
        <div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter text-red-500">Безопасность</h2>
          <p className="text-[10px] font-black text-gray-400 dark:text-app-muted uppercase tracking-[0.4em]">Журнал событий и угроз</p>
        </div>
      </div>
      <div className="bg-white dark:bg-app-card rounded-[3rem] border border-gray-100 dark:border-app-border overflow-hidden shadow-2xl">
        <SecurityTable logs={analytics?.securityLogs} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-app-bg text-blue-500 font-black gap-4 animate-pulse">
        <ShieldCheck className="w-16 h-16" />
        <span className="uppercase tracking-[0.5em] text-xs">Инициализация ядра...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-app-bg flex transition-colors overflow-hidden">
      
      {/* МЕНЮ НАВИГАЦИИ (SIDEBAR) */}
      <aside className="w-24 md:w-80 bg-white dark:bg-app-card border-r border-gray-100 dark:border-app-border flex flex-col p-6 space-y-10 z-50 shadow-2xl">
        <div className="flex items-center gap-4 px-2">
          <div className="p-4 bg-blue-600 rounded-[1.25rem] shadow-2xl shadow-blue-500/40 text-white">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <div className="hidden md:block">
            <span className="font-black text-2xl text-gray-900 dark:text-white tracking-tighter uppercase leading-none">AMPERE</span>
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-1">Центр управления</p>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          <NavItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart3 />} label="Главная" />
          <NavItem active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={<Users />} label="Сотрудники" />
          <NavItem active={activeTab === 'hardware'} onClick={() => setActiveTab('hardware')} icon={<LayoutGrid />} label="Оборудование" />
          <button 
            onClick={() => navigate('/reports')}
            className="w-full flex items-center gap-5 p-5 rounded-[1.25rem] transition-all text-gray-400 dark:text-app-muted hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white group"
          >
            <Zap className="w-5 h-5" />
            <span className="hidden md:block font-black uppercase text-[11px] tracking-widest">Отчеты</span>
          </button>
          <NavItem active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<ShieldAlert />} label="Защита" />
        </nav>

        <div className="pt-6 border-t border-gray-50 dark:border-app-border">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all group"
          >
            <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="hidden md:block font-black uppercase text-[11px] tracking-widest">Выйти из системы</span>
          </button>
        </div>
      </aside>

      {/* ОБЛАСТЬ КОНТЕНТА */}
      <main className="flex-1 p-8 md:p-16 overflow-y-auto custom-scrollbar relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-6xl mx-auto pb-20 text-left">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'team' && renderTeam()}
          {activeTab === 'hardware' && renderHardware()}
          {activeTab === 'security' && renderSecurity()}
        </div>
      </main>

      {/* ОКНО РЕГИСТРАЦИИ */}
      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)} title="Новый аккаунт">
          <form onSubmit={handleAddUser} className="space-y-6">
            <Input label="Логин сотрудника" placeholder="Например: ivanov_a" onChange={(e: any) => setNewUser({...newUser, username: e.target.value})} />
            <Input label="Пароль" type="password" placeholder="••••••••" onChange={(e: any) => setNewUser({...newUser, password: e.target.value})} />
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-gray-400 dark:text-app-muted uppercase ml-2 tracking-widest">Уровень доступа</label>
              <select className="w-full bg-gray-50 dark:bg-app-bg border border-gray-100 dark:border-app-border p-5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 dark:text-white font-black text-xs uppercase appearance-none cursor-pointer" onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="cashier">Кассир</option>
                <option value="admin">Администратор</option>
                <option value="financier">Финансист</option>
              </select>
            </div>
            <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] font-black uppercase text-xs shadow-2xl shadow-blue-500/20 active:scale-95 transition-all">Создать профиль</button>
          </form>
        </Modal>
      )}
    </div>
  );
};

// --- КОМПОНЕНТЫ ИНТЕРФЕЙСА ---

const NavItem = ({ active, icon, label, onClick }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-5 p-5 rounded-[1.25rem] transition-all relative group ${active ? 'bg-blue-600 text-white shadow-[0_15px_30px_rgba(37,99,235,0.3)] scale-[1.02]' : 'text-gray-400 dark:text-app-muted hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'}`}
  >
    {React.cloneElement(icon, { className: `w-5 h-5 ${active ? 'fill-current' : ''}` })}
    <span className="hidden md:block font-black uppercase text-[11px] tracking-widest">{label}</span>
    {active && <div className="absolute right-4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#fff]" />}
  </button>
);

const StatCard = ({ label, value, suffix, icon, color }: any) => {
  const colors: any = {
    blue: "text-blue-500 bg-blue-50/50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
    emerald: "text-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20",
    amber: "text-amber-500 bg-amber-50/50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20"
  };

  return (
    <div className="bg-white dark:bg-app-card p-10 rounded-[3rem] border border-gray-100 dark:border-app-border shadow-2xl shadow-black/5 flex items-center justify-between group hover:scale-[1.03] transition-all relative overflow-hidden">
      <div className="relative z-10 text-left">
        <p className="text-[10px] font-black text-gray-400 dark:text-app-muted uppercase tracking-[0.4em] mb-4">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-gray-900 dark:text-white font-mono tracking-tighter leading-none">{value}</span>
          {suffix && <span className="text-xs font-black text-gray-400 dark:text-app-muted uppercase">{suffix}</span>}
        </div>
      </div>
      <div className={`p-6 rounded-[1.5rem] border transition-all duration-500 group-hover:rotate-12 ${colors[color]}`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-8 h-8" }) : null}
      </div>
    </div>
  );
};

const UserCard = ({ user, onDelete }: any) => (
  <div className="bg-white dark:bg-app-card p-8 rounded-[2.5rem] border border-gray-100 dark:border-app-border shadow-xl flex items-center justify-between group hover:border-blue-500/20 transition-all hover:-translate-y-1">
    <div className="flex items-center gap-5">
      <div className="w-14 h-14 bg-gray-50 dark:bg-app-bg/50 rounded-2xl flex items-center justify-center font-black text-blue-500 border border-gray-100 dark:border-app-border uppercase text-xl shadow-inner group-hover:scale-105 transition-transform">
        {user.username[0]}
      </div>
      <div className="text-left">
        <p className="font-black text-gray-900 dark:text-white uppercase text-base tracking-tight">{user.username}</p>
        <p className="text-[10px] font-black text-gray-400 dark:text-app-muted uppercase tracking-[0.2em]">{user.role === 'admin' ? 'Администратор' : user.role === 'cashier' ? 'Кассир' : 'Финансист'}</p>
      </div>
    </div>
    <button onClick={onDelete} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100">
      <Trash2 className="w-6 h-6" />
    </button>
  </div>
);

const SecurityTable = ({ logs, compact }: any) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left font-mono text-[13px]">
      <thead className={`text-gray-400 dark:text-app-muted uppercase font-black tracking-widest border-b border-gray-50 dark:border-app-border ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        <tr>
          <th className="p-6">Событие</th>
          <th className="p-6">Детали</th>
          <th className="p-6 text-right">Время</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50 dark:divide-app-border">
        {logs?.map((log: any) => (
          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <td className="p-6 font-black text-red-500 uppercase tracking-tighter">{log.event_type}</td>
            <td className="p-6 text-gray-600 dark:text-gray-300 font-medium">{log.description}</td>
            <td className="p-6 text-right text-gray-400 text-xs">{new Date(log.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Modal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
    <div className="bg-white dark:bg-app-card rounded-[3rem] p-12 max-w-md w-full shadow-[0_0_80px_rgba(0,0,0,0.4)] animate-in fade-in zoom-in-95 relative border border-gray-100 dark:border-app-border text-left">
      <div className="flex justify-between items-center mb-10 text-left">
        <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none">{title}</h3>
        <button onClick={onClose} className="p-3 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6" /></button>
      </div>
      {children}
    </div>
  </div>
);

const Input = ({ label, ...props }: any) => (
  <div className="space-y-1 text-left">
    <label className="text-[10px] font-black text-gray-400 dark:text-app-muted uppercase ml-2 tracking-widest">{label}</label>
    <input {...props} className="w-full bg-gray-50 dark:bg-app-bg border border-gray-100 dark:border-app-border p-5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:text-white font-bold transition-all placeholder:text-gray-300" />
  </div>
);

export default AdminDashboard;

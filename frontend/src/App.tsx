import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import CashierDashboard from './components/CashierDashboard';
import AdminDashboard from './components/AdminDashboard';
import FinancierDashboard from './components/FinancierDashboard';
import { LogOut, Zap } from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-app-bg transition-colors">
      {user && (
        <nav className="bg-white dark:bg-app-card border-b border-gray-100 dark:border-app-border px-4 py-3 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-500 fill-blue-500/10" />
              <span className="font-black text-lg tracking-tight dark:text-white">AMPERE</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden md:block text-right">
                <p className="text-sm font-black dark:text-white leading-none">{user.username}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2.5 bg-gray-50 dark:bg-app-bg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>
      )}
      <main>{children}</main>
    </div>
  );
};

const RootRedirect = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  
  switch (user.role) {
    case 'admin': return <Navigate to="/admin" replace />;
    case 'cashier': return <Navigate to="/cashier" replace />;
    case 'financier': return <Navigate to="/finance" replace />;
    default: return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<ProtectedRoute><Layout><RootRedirect /></Layout></ProtectedRoute>} />
        
        <Route path="/cashier" element={
          <ProtectedRoute allowedRoles={['cashier', 'admin']}>
            <Layout><CashierDashboard /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Layout><AdminDashboard /></Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/finance" element={
          <ProtectedRoute allowedRoles={['financier', 'admin']}>
            <Layout><FinancierDashboard /></Layout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

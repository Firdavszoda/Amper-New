import React from 'react';
import { cn } from '../../lib/utils';

type StatusType = 'online' | 'offline' | 'charging' | 'available' | 'faulted' | 'pending' | 'completed' | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  dot?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, dot = true }) => {
  const normalizedStatus = status.toLowerCase();

  const styles: Record<string, string> = {
    online: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    available: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    charging: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    offline: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    faulted: 'bg-red-500/10 text-red-500 border-red-500/20',
    completed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    pending: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  const dotColors: Record<string, string> = {
    online: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse',
    available: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    charging: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse',
    offline: 'bg-gray-400',
    faulted: 'bg-red-500 shadow-[0_0_8px_rgba(239,44,44,0.6)]',
    completed: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]',
    pending: 'bg-purple-500',
  };

  const labels: Record<string, string> = {
    online: 'В СЕТИ',
    available: 'СВОБОДЕН',
    charging: 'ЗАРЯДКА',
    offline: 'ОФФЛАЙН',
    faulted: 'ОШИБКА',
    completed: 'ГОТОВО',
    pending: 'ОЖИДАНИЕ',
  };

  const activeStyle = styles[normalizedStatus] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  const activeDot = dotColors[normalizedStatus] || 'bg-gray-400';
  const label = labels[normalizedStatus] || status.toUpperCase();

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-tighter',
      activeStyle,
      className
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', activeDot)} />}
      {label}
    </div>
  );
};

export default StatusBadge;

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
    online: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20',
    available: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20',
    charging: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20',
    offline: 'bg-slate-100 dark:bg-gray-500/10 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-500/20',
    faulted: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20',
    completed: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20',
    pending: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-500/20',
  };

  const dotColors: Record<string, string> = {
    online: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse',
    available: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
    charging: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse',
    offline: 'bg-slate-400',
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

  const activeStyle = styles[normalizedStatus] || 'bg-slate-100 dark:bg-gray-500/10 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-500/20';
  const activeDot = dotColors[normalizedStatus] || 'bg-slate-400';
  const label = labels[normalizedStatus] || status.toUpperCase();

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-tighter transition-all',
      activeStyle,
      className
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', activeDot)} />}
      {label}
    </div>
  );
};

export default StatusBadge;
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  disabled,
  ...props
}) => {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 active:scale-95 transition-all',
    secondary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-app-muted transition-all',
    outline: 'bg-transparent border border-slate-200 dark:border-app-border hover:border-blue-500/30 text-slate-900 dark:text-white shadow-sm dark:shadow-none transition-all',
  };

  const sizes = {
    sm: 'px-4 py-2 text-[10px] rounded-xl font-black uppercase tracking-wider',
    md: 'px-6 py-3 text-xs rounded-2xl font-black uppercase tracking-widest',
    lg: 'px-8 py-4 text-sm rounded-3xl font-black uppercase tracking-widest',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed outline-none select-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
};

export default Button;
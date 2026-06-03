import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  glass = false,
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-[2.5rem] border border-gray-100 dark:border-app-border transition-all duration-300 shadow-2xl shadow-black/5 bg-white dark:bg-app-card',
        glass && 'bg-white/70 dark:bg-app-card/70 backdrop-blur-2xl',
        hoverable && 'hover:shadow-black/10 hover:-translate-y-1 hover:border-blue-500/20',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

import React from 'react';
import { cn } from '../../utils/cn';

export function Badge({ className, variant = 'default', children, ...props }) {
  const variants = {
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    primary: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    EASY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-medium',
    MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-medium',
    HARD: 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-medium',
    outline: 'bg-transparent text-slate-400 border-slate-700'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs border tracking-wide uppercase',
        variants[variant] || variants.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

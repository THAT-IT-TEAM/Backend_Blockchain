import * as React from 'react';
import { cn } from '@/lib/utils';

type Status = 'online' | 'offline' | 'degraded' | 'maintenance';

interface StatusCardProps {
  title: string;
  value: string | number;
  description?: string;
  status?: Status;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    value: string;
    direction: 'up' | 'down';
  };
  className?: string;
}

export function StatusCard({
  title,
  value,
  description,
  status = 'online',
  icon: Icon, // Use prop aliasing for clarity
  trend,
  className,
}: StatusCardProps) {
  const statusColors = {
    online: 'bg-emerald-500',
    offline: 'bg-destructive',
    degraded: 'bg-amber-500',
    maintenance: 'bg-blue-500',
  };

  const trendColors = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-destructive',
  };

  return (
    <div className={cn('rounded-lg border bg-card p-6 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="mt-1 flex items-baseline">
            <p className="text-2xl font-semibold">{value}</p>
            {trend && (
              <span
                className={cn(
                  'ml-2 flex items-center text-xs font-medium',
                  trendColors[trend.direction]
                )}
              >
                {trend.direction === 'up' ? (
                  <svg
                    className="mr-0.5 h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 12 12"
                  >
                    <path d="M5.293 3.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L7 6.414V11a1 1 0 11-2 0V6.414L2.707 8.707a1 1 0 01-1.414-1.414l4-4z" />
                  </svg>
                ) : (
                  <svg
                    className="mr-0.5 h-3 w-3"
                    fill="currentColor"
                    viewBox="0 0 12 12"
                  >
                    <path d="M5.293 7.293a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 6l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 01-.293-.707z" />
                  </svg>
                )}
                {trend.value}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        
        {Icon ? (
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        ) : status ? (
          <div className="flex flex-col items-center">
            <div className="flex items-center">
              <span
                className={cn(
                  'mr-1.5 h-2 w-2 rounded-full',
                  statusColors[status]
                )}
                aria-hidden="true"
              />
            </div>
            <span className="mt-1 text-xs capitalize text-muted-foreground">
              {status}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

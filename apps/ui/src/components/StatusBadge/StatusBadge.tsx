import { ReactNode } from 'react';

type ContainerStatus = 'running' | 'stopped' | 'error' | 'starting' | 'stopping';

interface StatusBadgeProps {
  status: ContainerStatus;
  children?: ReactNode;
  className?: string;
}

export const StatusBadge = ({ status, children, className = '' }: StatusBadgeProps) => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  const statusClasses = {
    running: 'bg-success-100 text-success-800',
    stopped: 'bg-neutral-100 text-neutral-800',
    error: 'bg-error-100 text-error-800',
    starting: 'bg-primary-100 text-primary-800',
    stopping: 'bg-neutral-100 text-neutral-800',
  };

  const statusDot = {
    running: 'bg-success-400',
    stopped: 'bg-neutral-400',
    error: 'bg-error-400',
    starting: 'bg-primary-400',
    stopping: 'bg-neutral-400',
  };

  const statusText = {
    running: 'Running',
    stopped: 'Stopped',
    error: 'Error',
    starting: 'Starting',
    stopping: 'Stopping',
  };

  const classes = `${baseClasses} ${statusClasses[status]} ${className}`;

  return (
    <span className={classes}>
      <span className={`w-2 h-2 rounded-full mr-1.5 ${statusDot[status]}`} />
      {children || statusText[status]}
    </span>
  );
};
import { memo, useCallback } from 'react';
import { ContainerCard } from '../ContainerCard';

interface Container {
  id: string;
  names: string[];
  image: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead';
  status: string;
  ports: Array<{
    host?: string;
    public?: number;
    private: number;
  }>;
  updateAvailable?: boolean;
}

interface ContainerListProps {
  containers: Container[];
  loading?: boolean;
  onStart: (id: string) => Promise<{ success: boolean; error?: string }>;
  onStop: (id: string) => Promise<{ success: boolean; error?: string }>;
  onRestart: (id: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const LoadingSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }).map((_, idx) => (
      <div key={idx} className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
          </div>
          <div className="h-6 bg-neutral-200 rounded-full w-16"></div>
        </div>
        <div className="mt-3">
          <div className="h-3 bg-neutral-200 rounded w-full"></div>
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-8 bg-neutral-200 rounded flex-1"></div>
          <div className="h-8 bg-neutral-200 rounded flex-1"></div>
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = () => (
  <div className="text-center py-12">
    <div className="mx-auto h-24 w-24 text-neutral-400">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-full h-full">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    </div>
    <h3 className="mt-2 text-sm font-semibold text-neutral-900">No containers</h3>
    <p className="mt-1 text-sm text-neutral-500">
      No containers are currently available. Create a new container to get started.
    </p>
  </div>
);

export const ContainerList = memo(({
  containers,
  loading = false,
  onStart,
  onStop,
  onRestart,
  onDelete,
}: ContainerListProps) => {
  // Memoize callbacks to prevent unnecessary re-renders
  const handleStart = useCallback(onStart, []);
  const handleStop = useCallback(onStop, []);
  const handleRestart = useCallback(onRestart, []);
  const handleDelete = useCallback(onDelete, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (containers.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      {containers.map((container) => (
        <ContainerCard
          key={container.id}
          container={container}
          onStart={handleStart}
          onStop={handleStop}
          onRestart={handleRestart}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
});
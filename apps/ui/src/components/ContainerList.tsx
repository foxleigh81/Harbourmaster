import type { Container } from '@harbourmaster/shared';
import { ContainerCard } from './ContainerCard';

interface ContainerListProps {
  containers: Container[];
  onStart: (id: string) => Promise<any>;
  onStop: (id: string) => Promise<any>;
  onRestart: (id: string) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
}

export function ContainerList({
  containers,
  onStart,
  onStop,
  onRestart,
  onDelete,
}: ContainerListProps) {
  if (containers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-24 w-24 text-gray-400">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No containers</h3>
        <p className="mt-1 text-sm text-gray-500">No containers are currently running.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      {containers.map((container) => (
        <ContainerCard
          key={container.id}
          container={container}
          onStart={onStart}
          onStop={onStop}
          onRestart={onRestart}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
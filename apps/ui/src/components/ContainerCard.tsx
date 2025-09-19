import { useState } from 'react';
import type { Container } from '@harbourmaster/shared';

interface ContainerCardProps {
  container: Container;
  onStart: (id: string) => Promise<any>;
  onStop: (id: string) => Promise<any>;
  onRestart: (id: string) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
}

export function ContainerCard({
  container,
  onStart,
  onStop,
  onRestart,
  onDelete,
}: ContainerCardProps) {
  const [isActing, setIsActing] = useState(false);

  const handleAction = async (action: () => Promise<any>) => {
    setIsActing(true);
    try {
      await action();
    } finally {
      setIsActing(false);
    }
  };

  const statusColor = {
    running: 'bg-green-100 text-green-800',
    exited: 'bg-gray-100 text-gray-800',
    paused: 'bg-yellow-100 text-yellow-800',
    restarting: 'bg-blue-100 text-blue-800',
    dead: 'bg-red-100 text-red-800',
  }[container.state];

  const statusIcon = {
    running: '🟢',
    exited: '⚫',
    paused: '⏸️',
    restarting: '🔄',
    dead: '🔴',
  }[container.state];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {container.names[0]?.replace(/^\//, '') || container.id.slice(0, 12)}
          </h3>
          <p className="mt-1 text-xs text-gray-500 truncate">
            {container.image}
          </p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          <span className="mr-1">{statusIcon}</span>
          {container.state}
        </span>
      </div>

      <div className="mt-3 text-xs text-gray-600">
        <p>{container.status}</p>
        {container.updateAvailable && (
          <p className="mt-1 text-blue-600">Update available</p>
        )}
      </div>

      {container.ports.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-700">Ports:</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {container.ports.map((port, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
              >
                {port.host && `${port.host}:`}{port.public || '?'}→{port.private}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {container.state === 'exited' ? (
          <button
            onClick={() => handleAction(() => onStart(container.id))}
            disabled={isActing}
            aria-label={`Start container ${container.names[0] || container.id}`}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Start
          </button>
        ) : container.state === 'running' ? (
          <>
            <button
              onClick={() => handleAction(() => onStop(container.id))}
              disabled={isActing}
              aria-label={`Stop container ${container.names[0] || container.id}`}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Stop
            </button>
            <button
              onClick={() => handleAction(() => onRestart(container.id))}
              disabled={isActing}
              aria-label={`Restart container ${container.names[0] || container.id}`}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Restart
            </button>
          </>
        ) : null}
        
        {container.state === 'exited' && (
          <button
            onClick={() => {
              if (confirm(`Delete container ${container.names[0] || container.id.slice(0, 12)}?`)) {
                handleAction(() => onDelete(container.id));
              }
            }}
            disabled={isActing}
            aria-label={`Delete container ${container.names[0] || container.id.slice(0, 12)}`}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
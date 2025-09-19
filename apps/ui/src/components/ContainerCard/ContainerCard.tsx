import { useState } from 'react';
import { Button } from '../Button';
import { StatusBadge } from '../StatusBadge';

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

interface ContainerCardProps {
  container: Container;
  onStart: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onRestart: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const mapStateToStatus = (state: string) => {
  switch (state) {
    case 'running':
      return 'running' as const;
    case 'exited':
      return 'stopped' as const;
    case 'restarting':
      return 'starting' as const;
    case 'dead':
      return 'error' as const;
    case 'paused':
      return 'stopped' as const;
    default:
      return 'stopped' as const;
  }
};

export const ContainerCard = ({
  container,
  onStart,
  onStop,
  onRestart,
  onDelete,
}: ContainerCardProps) => {
  const [isActing, setIsActing] = useState(false);

  const handleAction = async (action: () => Promise<void>) => {
    setIsActing(true);
    try {
      await action();
    } finally {
      setIsActing(false);
    }
  };

  const containerName = container.names[0]?.replace(/^\//, '') || container.id.slice(0, 12);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-neutral-900 truncate">
            {containerName}
          </h3>
          <p className="mt-1 text-xs text-neutral-500 truncate">
            {container.image}
          </p>
        </div>
        <StatusBadge status={mapStateToStatus(container.state)} />
      </div>

      <div className="mt-3 text-xs text-neutral-600">
        <p>{container.status}</p>
        {container.updateAvailable && (
          <p className="mt-1 text-primary-600">Update available</p>
        )}
      </div>

      {container.ports.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-700">Ports:</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {container.ports.map((port, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-neutral-100 text-neutral-700"
              >
                {port.host && `${port.host}:`}{port.public || '?'}→{port.private}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {container.state === 'exited' ? (
          <Button
            onClick={() => handleAction(() => onStart(container.id))}
            disabled={isActing}
            variant="primary"
            size="sm"
            className="flex-1"
          >
            Start
          </Button>
        ) : container.state === 'running' ? (
          <>
            <Button
              onClick={() => handleAction(() => onStop(container.id))}
              disabled={isActing}
              variant="danger"
              size="sm"
              className="flex-1"
            >
              Stop
            </Button>
            <Button
              onClick={() => handleAction(() => onRestart(container.id))}
              disabled={isActing}
              variant="primary"
              size="sm"
              className="flex-1"
            >
              Restart
            </Button>
          </>
        ) : null}

        {container.state === 'exited' && (
          <Button
            onClick={() => {
              if (confirm(`Delete container ${containerName}?`)) {
                handleAction(() => onDelete(container.id));
              }
            }}
            disabled={isActing}
            variant="secondary"
            size="sm"
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};
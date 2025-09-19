import { useState } from 'react';
import { useContainers } from '../hooks/useContainers';
import { ContainerList } from '../components/ContainerList';
import { Header } from '../components/Header';
import { Button } from '../components/Button';

export function Dashboard() {
  const [showAll, setShowAll] = useState(false);
  const {
    containers,
    isLoading,
    error,
    refetch,
    startContainer,
    stopContainer,
    restartContainer,
    deleteContainer,
  } = useContainers(showAll);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium text-neutral-900">Containers</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-neutral-600">Show all</span>
            </label>
          </div>
          <Button onClick={refetch} variant="secondary" size="sm">
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-error-50 p-4">
            <div className="text-sm text-error-800">{error}</div>
          </div>
        )}

        <ContainerList
          containers={containers}
          isLoading={isLoading}
          onStart={startContainer}
          onStop={stopContainer}
          onRestart={restartContainer}
          onDelete={deleteContainer}
        />
      </main>
    </div>
  );
}
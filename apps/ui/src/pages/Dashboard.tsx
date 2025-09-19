import { useState } from 'react';
import { useContainers } from '../hooks/useContainers';
import { ContainerList } from '../components/ContainerList';
import { useAuth } from '../hooks/useAuth';

export function Dashboard() {
  const [showAll, setShowAll] = useState(false);
  const { logout } = useAuth();
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
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-harbor-600 text-white px-4 py-2 rounded">
        Skip to main content
      </a>
      <header className="bg-white shadow-sm border-b border-gray-200" role="banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl mr-3" aria-hidden="true">⚓</span>
              <h1 className="text-xl font-semibold text-gray-900">Harbourmaster</h1>
            </div>
            <nav role="navigation">
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-harbor-500 focus:ring-offset-2 rounded px-2 py-1"
                aria-label="Sign out of Harbourmaster"
              >
                Sign out
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium text-gray-900">Containers</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-gray-300 text-harbor-600 focus:ring-harbor-500"
              />
              <span className="text-gray-600">Show all</span>
            </label>
          </div>
          <button
            onClick={refetch}
            className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-harbor-600"></div>
          </div>
        ) : (
          <ContainerList
            containers={containers}
            onStart={startContainer}
            onStop={stopContainer}
            onRestart={restartContainer}
            onDelete={deleteContainer}
          />
        )}
      </main>
    </div>
  );
}
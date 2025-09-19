import { Button } from '../Button';

interface HeaderProps {
  onLogout?: () => void;
  showLogout?: boolean;
}

export const Header = ({ onLogout, showLogout = true }: HeaderProps) => {
  return (
    <header className="bg-white border-b border-neutral-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-neutral-900">
                  Harbourmaster
                </h1>
              </div>
            </div>
          </div>

          {/* Navigation and Actions */}
          <div className="flex items-center space-x-4">
            <nav className="hidden md:flex space-x-6">
              <a
                href="/"
                className="text-neutral-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Containers
              </a>
              <span
                className="text-neutral-400 px-3 py-2 text-sm font-medium cursor-not-allowed relative group"
                title="Coming soon"
              >
                Images
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-neutral-800 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  Coming soon
                </span>
              </span>
              <span
                className="text-neutral-400 px-3 py-2 text-sm font-medium cursor-not-allowed relative group"
                title="Coming soon"
              >
                Volumes
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-neutral-800 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  Coming soon
                </span>
              </span>
              <span
                className="text-neutral-400 px-3 py-2 text-sm font-medium cursor-not-allowed relative group"
                title="Coming soon"
              >
                Networks
                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-neutral-800 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  Coming soon
                </span>
              </span>
            </nav>

            {/* System Status Indicator */}
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success-400 rounded-full"></div>
              <span className="hidden sm:inline text-sm text-neutral-600">
                Online
              </span>
            </div>

            {/* Logout Button */}
            {showLogout && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onLogout}
              >
                Logout
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
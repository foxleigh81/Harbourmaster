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
              <a
                href="/images"
                className="text-neutral-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Images
              </a>
              <a
                href="/volumes"
                className="text-neutral-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Volumes
              </a>
              <a
                href="/networks"
                className="text-neutral-700 hover:text-primary-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Networks
              </a>
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
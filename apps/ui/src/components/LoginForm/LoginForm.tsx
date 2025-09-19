import { useState, FormEvent } from 'react';
import { Button } from '../Button';

interface LoginFormProps {
  onSubmit: (password: string) => Promise<void>;
  loading?: boolean;
  error?: string;
}

export const LoginForm = ({ onSubmit, loading = false, error }: LoginFormProps) => {
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError('');

    if (!password.trim()) {
      setValidationError('Password is required');
      return;
    }

    if (password.length < 1) {
      setValidationError('Password cannot be empty');
      return;
    }

    try {
      await onSubmit(password);
    } catch (err) {
      // Error handling is managed by parent component via error prop
    }
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-xl flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
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
          <h2 className="mt-6 text-center text-3xl font-bold text-neutral-900">
            Welcome to Harbourmaster
          </h2>
          <p className="mt-2 text-center text-sm text-neutral-600">
            Enter your password to access the container management dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (validationError) {
                  setValidationError('');
                }
              }}
              disabled={loading}
              className={`relative block w-full px-3 py-2 border rounded-md placeholder-neutral-500 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm ${
                displayError
                  ? 'border-error-300 focus:ring-error-500 focus:border-error-500'
                  : 'border-neutral-300'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="Enter password"
            />
          </div>

          {displayError && (
            <div className="text-error-600 text-sm mt-2" role="alert">
              {displayError}
            </div>
          )}

          <div>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !password.trim()}
              className="group relative w-full flex justify-center"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-xs text-neutral-500">
            Harbourmaster OS - Docker Container Management
          </p>
        </div>
      </div>
    </div>
  );
};
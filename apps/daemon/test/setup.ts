/**
 * Test setup file
 */
import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Global test utilities
declare global {
  interface Window {
    __test_env__: 'test';
  }
}

// Mock crypto functions for tests
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomBytes: vi.fn().mockReturnValue(Buffer.from('test-random-bytes-16')),
  };
});

export {};
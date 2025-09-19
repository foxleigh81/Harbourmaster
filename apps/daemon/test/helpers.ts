/**
 * Test helper utilities
 */
import { vi } from 'vitest';
import type { Container } from '@harbourmaster/shared';

/**
 * Creates a mock container for testing
 */
export function createMockContainer(overrides: Partial<Container> = {}): Container {
  return {
    id: 'container123',
    names: ['test-container'],
    image: 'nginx:latest',
    state: 'running',
    status: 'Up 2 hours',
    ports: [
      {
        private: 80,
        public: 8080,
        type: 'tcp',
      },
    ],
    updateAvailable: false,
    ...overrides,
  };
}

/**
 * Creates a mock Fastify request object
 */
export function createMockRequest(overrides: any = {}) {
  return {
    id: 'test-request-id',
    headers: {},
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

/**
 * Creates a mock Fastify reply object
 */
export function createMockReply() {
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    raw: {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    },
  };
}

/**
 * Creates a mock Docker container info object
 */
export function createMockDockerContainer(overrides: any = {}) {
  return {
    Id: 'container123456789',
    Name: '/test-container',
    Config: {
      Image: 'nginx:latest',
    },
    State: {
      Status: 'running',
      Running: true,
    },
    NetworkSettings: {
      Ports: {
        '80/tcp': [
          {
            HostPort: '8080',
            HostIp: '0.0.0.0',
          },
        ],
      },
    },
    ...overrides,
  };
}

/**
 * Creates a mock auth payload
 */
export function createMockAuthPayload(overrides: any = {}) {
  return {
    type: 'admin',
    sessionId: 'session123',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
    ...overrides,
  };
}

/**
 * Creates a mock auth config
 */
export function createMockAuthConfig(overrides: any = {}) {
  return {
    passwordHash: '$2b$12$hashedpassword',
    jwtSecret: 'test-jwt-secret',
    created: '2023-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Creates a mock error with specific properties
 */
export function createMockError(
  message: string,
  statusCode?: number,
  code?: string
) {
  const error: any = new Error(message);
  if (statusCode) error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

/**
 * Waits for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock event stream for Docker events
 */
export function createMockEventStream() {
  const listeners: { [event: string]: Function[] } = {};

  return {
    on: vi.fn((event: string, callback: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }),
    emit: (event: string, data?: any) => {
      if (listeners[event]) {
        listeners[event].forEach((callback) => callback(data));
      }
    },
    destroy: vi.fn(),
  };
}

/**
 * Asserts that a response has the expected structure
 */
export function assertApiResponse(
  response: any,
  expected: {
    success: boolean;
    statusCode?: number;
    hasData?: boolean;
    hasError?: boolean;
  }
) {
  expect(response.statusCode).toBe(expected.statusCode || 200);

  const body = JSON.parse(response.body);
  expect(body.success).toBe(expected.success);
  expect(body).toHaveProperty('requestId');
  expect(body).toHaveProperty('timestamp');

  if (expected.hasData) {
    expect(body).toHaveProperty('data');
  }

  if (expected.hasError) {
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code');
  }
}

/**
 * Mock environment variables for test
 */
export function mockEnv(variables: Record<string, string>) {
  const originalEnv = { ...process.env };

  // Set mock variables
  Object.assign(process.env, variables);

  // Return cleanup function
  return () => {
    // Restore original environment
    Object.keys(variables).forEach((key) => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  };
}

/**
 * Suppresses console output during tests
 */
export function suppressConsole() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();

  return () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  };
}

/**
 * Generates a random string for testing
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates a mock container ID
 */
export function randomContainerId(): string {
  return randomString(64);
}

/**
 * Creates a mock JWT token (not actually signed)
 */
export function createMockJwtToken(payload: any = {}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const defaultPayload = { exp: Math.floor(Date.now() / 1000) + 3600 };
  const fullPayload = { ...defaultPayload, ...payload };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');

  return `${encodedHeader}.${encodedPayload}.mock-signature`;
}
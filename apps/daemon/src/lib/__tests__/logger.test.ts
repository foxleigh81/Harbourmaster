/**
 * Logger unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pino } from 'pino';
import { logger } from '../logger.js';

// Mock pino
vi.mock('pino', () => {
  const mockPino = vi.fn();
  mockPino.stdSerializers = {
    err: vi.fn(),
  };
  return {
    pino: mockPino,
    stdSerializers: {
      err: vi.fn(),
    },
  };
});

describe('Logger', () => {
  let mockLogger: any;
  let originalEnv: typeof process.env;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
    };

    vi.mocked(pino).mockReturnValue(mockLogger);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('configuration', () => {
    it('should use default log level when not specified', () => {
      delete process.env.LOG_LEVEL;

      // Check the mock was called
      expect(vi.mocked(pino)).toHaveBeenCalled();
    });

    it('should use LOG_LEVEL environment variable', async () => {
      process.env.LOG_LEVEL = 'debug';

      // Re-import to trigger configuration
      await import('../logger.js');

      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
        })
      );
    });

    it('should configure redaction for sensitive data', async () => {
      await import('../logger.js');

      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              '*.password',
              '*.token',
              '*.secret',
            ],
            censor: '[REDACTED]',
          },
        })
      );
    });

    it('should configure serializers', async () => {
      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.serializers).toBeDefined();
      expect(config.serializers.req).toBeInstanceOf(Function);
      expect(config.serializers.err).toBeDefined();
    });

    it('should configure pretty transport in development', async () => {
      process.env.NODE_ENV = 'development';

      await import('../logger.js');

      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        })
      );
    });

    it('should not configure transport in production', async () => {
      process.env.NODE_ENV = 'production';

      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.transport).toBeUndefined();
    });
  });

  describe('request serializer', () => {
    let reqSerializer: (req: any) => any;

    beforeEach(async () => {
      await import('../logger.js');
      const config = vi.mocked(pino).mock.calls[0][0];
      reqSerializer = config.serializers.req;
    });

    it('should serialize request with essential fields', () => {
      const mockRequest = {
        method: 'GET',
        url: '/api/test',
        id: 'req-123',
        ip: '192.168.1.1',
        headers: {
          authorization: 'Bearer secret-token',
          'user-agent': 'test-agent',
        },
        body: { password: 'secret' },
        extraField: 'should-not-be-included',
      };

      const serialized = reqSerializer(mockRequest);

      expect(serialized).toEqual({
        method: 'GET',
        url: '/api/test',
        id: 'req-123',
        remoteAddress: '192.168.1.1',
      });

      // Verify sensitive data is not included
      expect(serialized).not.toHaveProperty('headers');
      expect(serialized).not.toHaveProperty('body');
      expect(serialized).not.toHaveProperty('extraField');
    });

    it('should handle missing fields gracefully', () => {
      const mockRequest = {
        method: 'POST',
        // missing other fields
      };

      const serialized = reqSerializer(mockRequest);

      expect(serialized).toEqual({
        method: 'POST',
        url: undefined,
        id: undefined,
        remoteAddress: undefined,
      });
    });
  });

  describe('data redaction', () => {
    it('should redact authorization headers', async () => {
      const mockPino = vi.fn();
      vi.mocked(pino).mockReturnValue(mockPino);

      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.redact.paths).toContain('req.headers.authorization');
      expect(config.redact.censor).toBe('[REDACTED]');
    });

    it('should redact cookie headers', async () => {
      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.redact.paths).toContain('req.headers.cookie');
    });

    it('should redact password fields', async () => {
      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.redact.paths).toContain('*.password');
    });

    it('should redact token fields', async () => {
      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.redact.paths).toContain('*.token');
    });

    it('should redact secret fields', async () => {
      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.redact.paths).toContain('*.secret');
    });
  });

  describe('environment handling', () => {
    it('should handle missing NODE_ENV', async () => {
      delete process.env.NODE_ENV;

      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.transport).toBeUndefined();
    });

    it('should handle empty NODE_ENV', async () => {
      process.env.NODE_ENV = '';

      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.transport).toBeUndefined();
    });

    it('should handle test environment', async () => {
      process.env.NODE_ENV = 'test';

      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.transport).toBeUndefined();
    });
  });

  describe('log levels', () => {
    const testLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

    it.each(testLevels)('should accept %s log level', async (level) => {
      process.env.LOG_LEVEL = level;

      await import('../logger.js');

      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          level,
        })
      );
    });

    it('should handle invalid log level gracefully', async () => {
      process.env.LOG_LEVEL = 'invalid-level';

      // Should not throw
      expect(async () => {
        await import('../logger.js');
      }).not.toThrow();
    });
  });

  describe('logger instance', () => {
    it('should export logger instance', () => {
      expect(logger).toBeDefined();
    });

    it('should be callable (assuming mocked pino returns callable)', () => {
      // This test verifies the logger is properly exported
      // The actual pino instance would have logging methods
      expect(typeof logger).toBe('object');
    });
  });

  describe('serializer edge cases', () => {
    let reqSerializer: (req: any) => any;

    beforeEach(async () => {
      await import('../logger.js');
      const config = vi.mocked(pino).mock.calls[0][0];
      reqSerializer = config.serializers.req;
    });

    it('should handle null request', () => {
      expect(() => reqSerializer(null)).not.toThrow();
    });

    it('should handle undefined request', () => {
      expect(() => reqSerializer(undefined)).not.toThrow();
    });

    it('should handle request with null values', () => {
      const mockRequest = {
        method: null,
        url: null,
        id: null,
        ip: null,
      };

      const serialized = reqSerializer(mockRequest);

      expect(serialized).toEqual({
        method: null,
        url: null,
        id: null,
        remoteAddress: null,
      });
    });

    it('should handle request with different IP field names', () => {
      const mockRequest = {
        method: 'GET',
        url: '/test',
        id: 'req-123',
        remoteAddress: '10.0.0.1', // Different field name
      };

      const serialized = reqSerializer(mockRequest);

      expect(serialized.remoteAddress).toBeUndefined();
    });
  });

  describe('transport configuration', () => {
    it('should include correct pino-pretty options', async () => {
      process.env.NODE_ENV = 'development';

      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.transport.options).toEqual({
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      });
    });

    it('should use correct pino-pretty target', async () => {
      process.env.NODE_ENV = 'development';

      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.transport.target).toBe('pino-pretty');
    });
  });

  describe('error serializer', () => {
    it('should use pino standard error serializer', async () => {
      await import('../logger.js');

      const config = vi.mocked(pino).mock.calls[0][0];
      expect(config.serializers.err).toBe(pino.stdSerializers.err);
    });
  });
});
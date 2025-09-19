/**
 * Error normalizer unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, ErrorNormalizer } from '../errors.js';
import { ErrorCode } from '@harbourmaster/shared';

// Mock logger
vi.mock('../logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ApiError', () => {
  it('should create ApiError with all properties', () => {
    const error = new ApiError(
      ErrorCode.CONTAINER_NOT_FOUND,
      'Test error message',
      404
    );

    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('Test error message');
    expect(error.code).toBe(ErrorCode.CONTAINER_NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error).toBeInstanceOf(Error);
  });

  it('should use default status code 500', () => {
    const error = new ApiError(ErrorCode.UNKNOWN_ERROR, 'Test error');

    expect(error.statusCode).toBe(500);
  });

  it('should be throwable', () => {
    expect(() => {
      throw new ApiError(ErrorCode.INVALID_INPUT, 'Test error');
    }).toThrow('Test error');
  });
});

describe('ErrorNormalizer', () => {
  const requestId = 'test-request-123';
  let mockLogger: any;

  beforeEach(async () => {
    const { logger } = await import('../logger.js');
    mockLogger = logger;
    vi.clearAllMocks();
  });

  describe('normalize', () => {
    it('should log all errors with request ID', () => {
      const error = new Error('Test error');

      ErrorNormalizer.normalize(error, requestId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Request ${requestId} failed:`,
        error
      );
    });

    it('should include request ID in all normalized errors', () => {
      const error = new Error('Test error');

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result.requestId).toBe(requestId);
    });
  });

  describe('container not found errors', () => {
    it('should normalize 404 status code errors', () => {
      const error = { statusCode: 404, message: 'Container not found' };

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.CONTAINER_NOT_FOUND,
        message: 'Container not found',
        requestId,
      });
    });

    it('should normalize errors with "not found" message', () => {
      const error = new Error('Something not found');

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.CONTAINER_NOT_FOUND,
        message: 'Container not found',
        requestId,
      });
    });

    it('should handle various "not found" message formats', () => {
      const testCases = [
        'Container not found',
        'Image not found',
        'Resource not found',
        'not found in database',
      ];

      for (const message of testCases) {
        const error = new Error(message);
        const result = ErrorNormalizer.normalize(error, requestId);

        expect(result.code).toBe(ErrorCode.CONTAINER_NOT_FOUND);
        expect(result.message).toBe('Container not found');
      }
    });
  });

  describe('container state errors', () => {
    it('should normalize already running errors', () => {
      const error = { statusCode: 409, message: 'Container already started' };

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.ALREADY_RUNNING,
        message: 'Container is already running',
        requestId,
      });
    });

    it('should handle various already running message formats', () => {
      const testCases = [
        'Container already started',
        'already running',
        'Container is already running',
      ];

      for (const message of testCases) {
        const error = { statusCode: 409, message };
        const result = ErrorNormalizer.normalize(error, requestId);

        expect(result.code).toBe(ErrorCode.ALREADY_RUNNING);
      }
    });

    it('should normalize already stopped errors', () => {
      const error = { statusCode: 409, message: 'Container not running' };

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.ALREADY_STOPPED,
        message: 'Container is already stopped',
        requestId,
      });
    });

    it('should handle various already stopped message formats', () => {
      const testCases = [
        'Container not running',
        'already stopped',
        'Container is already stopped',
      ];

      for (const message of testCases) {
        const error = { statusCode: 409, message };
        const result = ErrorNormalizer.normalize(error, requestId);

        expect(result.code).toBe(ErrorCode.ALREADY_STOPPED);
      }
    });
  });

  describe('permission errors', () => {
    it('should normalize EACCES errors', () => {
      const error = { code: 'EACCES', message: 'Permission denied' };

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.PERMISSION_DENIED,
        message: 'Permission denied. Check Docker socket permissions.',
        requestId,
      });
    });

    it('should normalize 403 status code errors', () => {
      const error = { statusCode: 403, message: 'Forbidden' };

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.PERMISSION_DENIED,
        message: 'Permission denied. Check Docker socket permissions.',
        requestId,
      });
    });
  });

  describe('docker unavailable errors', () => {
    it('should normalize ENOENT errors', () => {
      const error = { code: 'ENOENT', message: 'Socket not found' };

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.DOCKER_UNAVAILABLE,
        message: 'Cannot connect to Docker. Is Docker running?',
        requestId,
      });
    });

    it('should normalize connection errors', () => {
      const error = new Error('Cannot connect to Docker daemon');

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.DOCKER_UNAVAILABLE,
        message: 'Cannot connect to Docker. Is Docker running?',
        requestId,
      });
    });
  });

  describe('authentication errors', () => {
    it('should normalize invalid password errors', () => {
      const error = new Error('Invalid password');

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.AUTHENTICATION_REQUIRED,
        message: 'Invalid credentials',
        requestId,
      });
    });

    it('should handle various invalid password messages', () => {
      const testCases = [
        'Invalid password',
        'Password is invalid',
        'Invalid password provided',
      ];

      for (const message of testCases) {
        const error = new Error(message);
        const result = ErrorNormalizer.normalize(error, requestId);

        expect(result.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
        expect(result.message).toBe('Invalid credentials');
      }
    });
  });

  describe('generic errors', () => {
    it('should normalize unknown errors', () => {
      const error = new Error('Unexpected error');

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'An error occurred. Check logs for details.',
        requestId,
      });
    });

    it('should handle null errors', () => {
      const result = ErrorNormalizer.normalize(null, requestId);

      expect(result).toEqual({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'An error occurred. Check logs for details.',
        requestId,
      });
    });

    it('should handle undefined errors', () => {
      const result = ErrorNormalizer.normalize(undefined, requestId);

      expect(result).toEqual({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'An error occurred. Check logs for details.',
        requestId,
      });
    });

    it('should handle errors without message', () => {
      const error = { statusCode: 500 };

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result).toEqual({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'An error occurred. Check logs for details.',
        requestId,
      });
    });
  });

  describe('error priority', () => {
    it('should prioritize status code over message for 404 errors', () => {
      const error = {
        statusCode: 404,
        message: 'Invalid password', // Conflicting message
      };

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result.code).toBe(ErrorCode.CONTAINER_NOT_FOUND);
    });

    it('should prioritize specific error codes over status codes', () => {
      const error = {
        code: 'EACCES',
        statusCode: 500, // Generic status code
      };

      const result = ErrorNormalizer.normalize(error, requestId);

      expect(result.code).toBe(ErrorCode.PERMISSION_DENIED);
    });
  });

  describe('message variations', () => {
    it('should handle case-insensitive matching', () => {
      const testCases = [
        { message: 'NOT FOUND', expectedCode: ErrorCode.CONTAINER_NOT_FOUND },
        { message: 'ALREADY RUNNING', expectedCode: ErrorCode.ALREADY_RUNNING },
        { message: 'cannot connect', expectedCode: ErrorCode.DOCKER_UNAVAILABLE },
      ];

      for (const { message, expectedCode } of testCases) {
        const error = new Error(message);
        const result = ErrorNormalizer.normalize(error, requestId);

        expect(result.code).toBe(expectedCode);
      }
    });

    it('should handle partial message matching', () => {
      const testCases = [
        { message: 'Something not found here', expectedCode: ErrorCode.CONTAINER_NOT_FOUND },
        { message: 'Container already started successfully', expectedCode: ErrorCode.ALREADY_RUNNING },
        { message: 'Failed to connect to Docker daemon', expectedCode: ErrorCode.DOCKER_UNAVAILABLE },
      ];

      for (const { message, expectedCode } of testCases) {
        const error = new Error(message);
        const result = ErrorNormalizer.normalize(error, requestId);

        expect(result.code).toBe(expectedCode);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle circular references in error objects', () => {
      const error: any = { message: 'Test error' };
      error.self = error; // Create circular reference

      expect(() => {
        ErrorNormalizer.normalize(error, requestId);
      }).not.toThrow();
    });

    it('should handle errors with symbol properties', () => {
      const error = new Error('Test error');
      (error as any)[Symbol.for('test')] = 'symbol value';

      expect(() => {
        ErrorNormalizer.normalize(error, requestId);
      }).not.toThrow();
    });

    it('should handle errors with function properties', () => {
      const error = new Error('Test error');
      (error as any).someFunction = () => 'test';

      expect(() => {
        ErrorNormalizer.normalize(error, requestId);
      }).not.toThrow();
    });

    it('should handle errors with getter properties', () => {
      const error = new Error('Test error');
      Object.defineProperty(error, 'customProp', {
        get() {
          throw new Error('Getter error');
        },
      });

      expect(() => {
        ErrorNormalizer.normalize(error, requestId);
      }).not.toThrow();
    });
  });

  describe('request ID validation', () => {
    it('should handle empty request ID', () => {
      const error = new Error('Test error');

      const result = ErrorNormalizer.normalize(error, '');

      expect(result.requestId).toBe('');
    });

    it('should handle undefined request ID', () => {
      const error = new Error('Test error');

      const result = ErrorNormalizer.normalize(error, undefined as any);

      expect(result.requestId).toBeUndefined();
    });

    it('should handle null request ID', () => {
      const error = new Error('Test error');

      const result = ErrorNormalizer.normalize(error, null as any);

      expect(result.requestId).toBeNull();
    });
  });

  describe('logging behavior', () => {
    it('should log different error types correctly', () => {
      const testCases = [
        new Error('Standard error'),
        { statusCode: 404, message: 'Not found' },
        { code: 'EACCES' },
        'String error',
        123,
        null,
        undefined,
      ];

      for (const error of testCases) {
        ErrorNormalizer.normalize(error, requestId);

        expect(mockLogger.error).toHaveBeenCalledWith(
          `Request ${requestId} failed:`,
          error
        );
      }
    });
  });
});
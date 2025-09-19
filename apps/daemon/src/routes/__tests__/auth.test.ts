/**
 * Auth routes unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import authRoutes from '../auth.js';
import { AuthService } from '../../services/auth.js';
import type { AuthResponse } from '@harbourmaster/shared';

// Mock dependencies
vi.mock('../../services/auth.js', () => ({
  AuthService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../lib/errors.js', () => ({
  ErrorNormalizer: {
    normalize: vi.fn(),
  },
}));

describe('Auth Routes', () => {
  let fastify: FastifyInstance;
  let mockAuthService: any;
  let mockErrorNormalizer: any;

  beforeEach(async () => {
    // Create Fastify instance
    fastify = Fastify();

    // Setup mock AuthService
    mockAuthService = {
      login: vi.fn(),
    };

    vi.mocked(AuthService.getInstance).mockReturnValue(mockAuthService);

    // Setup mock ErrorNormalizer
    const { ErrorNormalizer } = await import('../../lib/errors.js');
    mockErrorNormalizer = vi.mocked(ErrorNormalizer);

    // Register routes
    await fastify.register(authRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('POST /login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockAuthResponse: AuthResponse = {
        token: 'jwt-token-123',
        expiresIn: 86400,
        csrf: 'csrf-token-123',
      };

      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'valid-password',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: mockAuthResponse,
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });

      expect(mockAuthService.login).toHaveBeenCalledWith('valid-password');
    });

    it('should fail with invalid credentials', async () => {
      const mockError = new Error('Invalid password');
      mockAuthService.login.mockRejectedValue(mockError);

      const mockNormalizedError = {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Invalid credentials',
        requestId: 'test-request-id',
      };

      mockErrorNormalizer.normalize.mockReturnValue(mockNormalizedError);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'invalid-password',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        ...mockNormalizedError,
        timestamp: expect.any(Number),
      });

      expect(mockErrorNormalizer.normalize).toHaveBeenCalledWith(
        mockError,
        expect.any(String)
      );
    });

    it('should validate password field is required', async () => {
      mockErrorNormalizer.normalize.mockReturnValue({
        code: 'INVALID_INPUT',
        message: 'Validation error',
        requestId: 'test-request-id',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {},
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should validate password is not empty', async () => {
      mockErrorNormalizer.normalize.mockReturnValue({
        code: 'INVALID_INPUT',
        message: 'Validation error',
        requestId: 'test-request-id',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: '',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should handle password as non-string gracefully', async () => {
      mockErrorNormalizer.normalize.mockReturnValue({
        code: 'INVALID_INPUT',
        message: 'Validation error',
        requestId: 'test-request-id',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 123,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should include request ID in success response', async () => {
      const mockAuthResponse: AuthResponse = {
        token: 'jwt-token-123',
        expiresIn: 86400,
        csrf: 'csrf-token-123',
      };

      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'valid-password',
        },
      });

      const body = JSON.parse(response.body);
      expect(body.requestId).toBeDefined();
      expect(typeof body.requestId).toBe('string');
    });

    it('should include timestamp in response', async () => {
      const beforeTime = Date.now();

      const mockAuthResponse: AuthResponse = {
        token: 'jwt-token-123',
        expiresIn: 86400,
        csrf: 'csrf-token-123',
      };

      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'valid-password',
        },
      });

      const afterTime = Date.now();
      const body = JSON.parse(response.body);

      expect(body.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(body.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should handle auth service errors gracefully', async () => {
      const mockError = new Error('Auth service unavailable');
      mockAuthService.login.mockRejectedValue(mockError);

      const mockNormalizedError = {
        code: 'UNKNOWN_ERROR',
        message: 'An error occurred. Check logs for details.',
        requestId: 'test-request-id',
      };

      mockErrorNormalizer.normalize.mockReturnValue(mockNormalizedError);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'valid-password',
        },
      });

      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNKNOWN_ERROR');
    });

    it('should pass request ID to error normalizer', async () => {
      const mockError = new Error('Test error');
      mockAuthService.login.mockRejectedValue(mockError);

      mockErrorNormalizer.normalize.mockReturnValue({
        code: 'TEST_ERROR',
        message: 'Test error',
        requestId: 'test-request-id',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'valid-password',
        },
      });

      expect(mockErrorNormalizer.normalize).toHaveBeenCalledWith(
        mockError,
        expect.any(String)
      );

      // Verify the request ID is passed through
      const requestId = mockErrorNormalizer.normalize.mock.calls[0][1];
      expect(typeof requestId).toBe('string');
      expect(requestId.length).toBeGreaterThan(0);
    });
  });

  describe('input validation', () => {
    it('should accept valid password strings', async () => {
      const validPasswords = [
        'simple',
        'with spaces',
        'with-special-chars!@#$%',
        '12345',
        'very-long-password-that-should-still-be-accepted',
      ];

      mockAuthService.login.mockResolvedValue({
        token: 'token',
        expiresIn: 3600,
      });

      for (const password of validPasswords) {
        const response = await fastify.inject({
          method: 'POST',
          url: '/login',
          payload: { password },
        });

        expect(response.statusCode).toBe(200);
        expect(mockAuthService.login).toHaveBeenCalledWith(password);
      }
    });

    it('should reject invalid input types', async () => {
      mockErrorNormalizer.normalize.mockReturnValue({
        code: 'INVALID_INPUT',
        message: 'Validation error',
        requestId: 'test-request-id',
      });

      const invalidInputs = [
        null,
        undefined,
        123,
        [],
        {},
        true,
        false,
      ];

      for (const password of invalidInputs) {
        const response = await fastify.inject({
          method: 'POST',
          url: '/login',
          payload: { password },
        });

        expect(response.statusCode).toBe(401);
      }
    });

    it('should reject empty or whitespace-only passwords', async () => {
      mockErrorNormalizer.normalize.mockReturnValue({
        code: 'INVALID_INPUT',
        message: 'Validation error',
        requestId: 'test-request-id',
      });

      const emptyPasswords = ['', '   ', '\t', '\n'];

      for (const password of emptyPasswords) {
        const response = await fastify.inject({
          method: 'POST',
          url: '/login',
          payload: { password },
        });

        expect(response.statusCode).toBe(401);
      }
    });

    it('should handle missing request body', async () => {
      mockErrorNormalizer.normalize.mockReturnValue({
        code: 'INVALID_INPUT',
        message: 'Validation error',
        requestId: 'test-request-id',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should handle invalid JSON', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: 'invalid-json',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('response format', () => {
    beforeEach(() => {
      mockAuthService.login.mockResolvedValue({
        token: 'jwt-token-123',
        expiresIn: 86400,
        csrf: 'csrf-token-123',
      });
    });

    it('should return valid JSON', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'valid-password',
        },
      });

      expect(() => JSON.parse(response.body)).not.toThrow();
    });

    it('should have correct content type', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'valid-password',
        },
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include all required success fields', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'valid-password',
        },
      });

      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('requestId');
      expect(body).toHaveProperty('timestamp');
    });

    it('should include all required error fields', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Test error'));
      mockErrorNormalizer.normalize.mockReturnValue({
        code: 'TEST_ERROR',
        message: 'Test error message',
        requestId: 'test-request-id',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'invalid-password',
        },
      });

      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('code');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('requestId');
      expect(body).toHaveProperty('timestamp');
    });
  });

  describe('HTTP methods', () => {
    it('should only accept POST requests', async () => {
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const response = await fastify.inject({
          method,
          url: '/login',
        });

        expect(response.statusCode).toBe(404);
      }
    });

    it('should accept POST requests', async () => {
      mockAuthService.login.mockResolvedValue({
        token: 'token',
        expiresIn: 3600,
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {
          password: 'valid-password',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
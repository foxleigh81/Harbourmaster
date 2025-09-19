/**
 * Auth middleware unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../auth.js';
import { AuthService } from '../../services/auth.js';
import { ErrorCode } from '@harbourmaster/shared';

// Mock AuthService
vi.mock('../../services/auth.js', () => ({
  AuthService: {
    getInstance: vi.fn(),
  },
}));

describe('authenticate middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockAuthService: any;

  beforeEach(() => {
    // Setup mock request
    mockRequest = {
      id: 'test-request-id',
      headers: {},
    };

    // Setup mock reply
    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Setup mock auth service
    mockAuthService = {
      validateToken: vi.fn(),
    };

    vi.mocked(AuthService.getInstance).mockReturnValue(mockAuthService);
  });

  describe('token validation', () => {
    it('should fail when no authorization header', async () => {
      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: ErrorCode.AUTHENTICATION_REQUIRED,
        requestId: 'test-request-id',
        timestamp: expect.any(Number),
      });
    });

    it('should fail when authorization header is empty', async () => {
      mockRequest.headers!.authorization = '';

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: ErrorCode.AUTHENTICATION_REQUIRED,
        requestId: 'test-request-id',
        timestamp: expect.any(Number),
      });
    });

    it('should extract token from Bearer authorization header', async () => {
      const token = 'valid-jwt-token';
      mockRequest.headers!.authorization = `Bearer ${token}`;
      mockAuthService.validateToken.mockReturnValue({ type: 'admin' });

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(token);
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should fail when token is invalid', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      mockAuthService.validateToken.mockReturnValue(null);

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token',
        code: ErrorCode.INVALID_TOKEN,
        requestId: 'test-request-id',
        timestamp: expect.any(Number),
      });
    });

    it('should pass when token is valid', async () => {
      const payload = { type: 'admin', sessionId: 'session123' };
      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockAuthService.validateToken.mockReturnValue(payload);

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
      expect((mockRequest as any).user).toEqual(payload);
    });
  });

  describe('CSRF validation', () => {
    it('should pass when no CSRF token in payload', async () => {
      const payload = { type: 'admin', sessionId: 'session123' };
      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockAuthService.validateToken.mockReturnValue(payload);

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should fail when CSRF token missing from header', async () => {
      const payload = {
        type: 'admin',
        sessionId: 'session123',
        csrf: 'csrf-token-123',
      };
      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockAuthService.validateToken.mockReturnValue(payload);

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token validation failed',
        code: ErrorCode.CSRF_FAILED,
        requestId: 'test-request-id',
        timestamp: expect.any(Number),
      });
    });

    it('should fail when CSRF tokens do not match', async () => {
      const payload = {
        type: 'admin',
        sessionId: 'session123',
        csrf: 'csrf-token-123',
      };
      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockRequest.headers!['x-csrf-token'] = 'different-csrf-token';
      mockAuthService.validateToken.mockReturnValue(payload);

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        error: 'CSRF token validation failed',
        code: ErrorCode.CSRF_FAILED,
        requestId: 'test-request-id',
        timestamp: expect.any(Number),
      });
    });

    it('should pass when CSRF tokens match', async () => {
      const csrfToken = 'csrf-token-123';
      const payload = {
        type: 'admin',
        sessionId: 'session123',
        csrf: csrfToken,
      };
      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockRequest.headers!['x-csrf-token'] = csrfToken;
      mockAuthService.validateToken.mockReturnValue(payload);

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
      expect((mockRequest as any).user).toEqual(payload);
    });
  });

  describe('request context', () => {
    it('should attach user payload to request', async () => {
      const payload = {
        type: 'admin',
        sessionId: 'session123',
        iat: 1234567890,
      };
      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockAuthService.validateToken.mockReturnValue(payload);

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).user).toEqual(payload);
    });

    it('should include request ID in all error responses', async () => {
      const testCases = [
        { headers: {}, expectedCode: 401 },
        { headers: { authorization: 'Bearer invalid' }, expectedCode: 401 },
        {
          headers: {
            authorization: 'Bearer valid',
            'x-csrf-token': 'wrong',
          },
          expectedCode: 403,
          payload: { csrf: 'correct' },
        },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        mockRequest.headers = testCase.headers;

        if (testCase.payload) {
          mockAuthService.validateToken.mockReturnValue(testCase.payload);
        } else {
          mockAuthService.validateToken.mockReturnValue(null);
        }

        await authenticate(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        );

        expect(mockReply.send).toHaveBeenCalledWith(
          expect.objectContaining({
            requestId: 'test-request-id',
          })
        );
      }
    });
  });

  describe('edge cases', () => {
    it('should handle authorization header without Bearer prefix', async () => {
      mockRequest.headers!.authorization = 'token-without-bearer';

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockAuthService.validateToken).toHaveBeenCalledWith('token-without-bearer');
    });

    it('should handle multiple spaces in authorization header', async () => {
      mockRequest.headers!.authorization = 'Bearer  token-with-spaces  ';
      mockAuthService.validateToken.mockReturnValue({ type: 'admin' });

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockAuthService.validateToken).toHaveBeenCalledWith(' token-with-spaces  ');
    });

    it('should handle case-insensitive CSRF header', async () => {
      const csrfToken = 'csrf-token-123';
      const payload = {
        type: 'admin',
        csrf: csrfToken,
      };
      mockRequest.headers!.authorization = 'Bearer valid-token';
      mockRequest.headers!['X-CSRF-TOKEN'] = csrfToken; // Different case
      mockAuthService.validateToken.mockReturnValue(payload);

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should still fail because header names are case-sensitive in HTTP
      expect(mockReply.code).toHaveBeenCalledWith(403);
    });
  });

  describe('timing', () => {
    it('should include timestamp in responses', async () => {
      const beforeTime = Date.now();

      await authenticate(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const afterTime = Date.now();
      const response = vi.mocked(mockReply.send).mock.calls[0][0];

      expect(response.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(response.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
});
/**
 * Authentication middleware
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.js';
import { ErrorCode } from '@harbourmaster/shared';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    reply.code(401).send({
      success: false,
      error: 'Authentication required',
      code: ErrorCode.AUTHENTICATION_REQUIRED,
      requestId: request.id,
      timestamp: Date.now()
    });
    return;
  }

  const authService = AuthService.getInstance();
  const payload = authService.validateToken(token);

  if (!payload) {
    reply.code(401).send({
      success: false,
      error: 'Invalid or expired token',
      code: ErrorCode.INVALID_TOKEN,
      requestId: request.id,
      timestamp: Date.now()
    });
    return;
  }

  // Validate CSRF token if present in payload
  if (payload.csrf) {
    const csrfHeader = request.headers['x-csrf-token'] as string;
    if (!csrfHeader || csrfHeader !== payload.csrf) {
      reply.code(403).send({
        success: false,
        error: 'CSRF token validation failed',
        code: ErrorCode.CSRF_FAILED,
        requestId: request.id,
        timestamp: Date.now()
      });
      return;
    }
  }

  // Attach user info to request for later use
  (request as any).user = payload;
}
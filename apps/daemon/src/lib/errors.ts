/**
 * Error normalization and handling
 */
import { ErrorCode } from '@harbourmaster/shared';
import { logger } from './logger.js';

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ErrorNormalizer {
  static normalize(error: any, requestId: string): {
    code: ErrorCode;
    message: string;
    requestId: string;
  } {
    // Log full error with request ID
    logger.error(`Request ${requestId} failed:`, error);

    // Handle null/undefined errors
    if (!error) {
      return {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'An error occurred. Check logs for details.',
        requestId
      };
    }

    // Container not found
    if (error.statusCode === 404 || error.message?.toLowerCase().includes('not found')) {
      return {
        code: ErrorCode.CONTAINER_NOT_FOUND,
        message: 'Container not found',
        requestId
      };
    }

    // Already running/stopped
    if (error.statusCode === 409) {
      const message = error.message?.toLowerCase() || '';
      if (message.includes('already started') || message.includes('already running')) {
        return {
          code: ErrorCode.ALREADY_RUNNING,
          message: 'Container is already running',
          requestId
        };
      }
      if (message.includes('not running') || message.includes('already stopped')) {
        return {
          code: ErrorCode.ALREADY_STOPPED,
          message: 'Container is already stopped',
          requestId
        };
      }
    }

    // Permission denied
    if (error.code === 'EACCES' || error.statusCode === 403) {
      return {
        code: ErrorCode.PERMISSION_DENIED,
        message: 'Permission denied. Check Docker socket permissions.',
        requestId
      };
    }

    // Docker unavailable
    if (error.code === 'ENOENT' || error.message?.toLowerCase().includes('cannot connect')) {
      return {
        code: ErrorCode.DOCKER_UNAVAILABLE,
        message: 'Cannot connect to Docker. Is Docker running?',
        requestId
      };
    }

    // Authentication errors
    if (error.message?.toLowerCase().includes('invalid password')) {
      return {
        code: ErrorCode.AUTHENTICATION_REQUIRED,
        message: 'Invalid credentials',
        requestId
      };
    }

    // Generic error
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'An error occurred. Check logs for details.',
      requestId
    };
  }
}
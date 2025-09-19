/**
 * Shared type definitions for Harbourmaster
 */

export interface Container {
  id: string;
  names: string[];
  image: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead';
  status: string;
  ports: Port[];
  updateAvailable?: boolean;
}

export interface Port {
  private: number;
  public?: number | null;
  type: 'tcp' | 'udp';
  host?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: ErrorCode;
  requestId: string;
  timestamp: number;
}

export enum ErrorCode {
  CONTAINER_NOT_FOUND = 'CONTAINER_NOT_FOUND',
  ALREADY_RUNNING = 'ALREADY_RUNNING',
  ALREADY_STOPPED = 'ALREADY_STOPPED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PULL_FAILED = 'PULL_FAILED',
  DOCKER_UNAVAILABLE = 'DOCKER_UNAVAILABLE',
  INVALID_INPUT = 'INVALID_INPUT',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  CSRF_FAILED = 'CSRF_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
  csrf?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: number;
  docker: {
    connected: boolean;
    socket: string;
  };
  version: string;
}
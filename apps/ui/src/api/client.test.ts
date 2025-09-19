import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiClient } from './client';
import type { Container, ApiResponse, AuthResponse } from '@harbourmaster/shared';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock location
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    apiClient.clearAuth();
  });

  describe('Authentication', () => {
    it('should set and get authentication state', () => {
      expect(apiClient.isAuthenticated()).toBe(false);

      apiClient.setAuth('test-token', 'test-csrf');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('harbourmaster_token', 'test-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('harbourmaster_csrf', 'test-csrf');
      expect(apiClient.isAuthenticated()).toBe(true);
    });

    it('should clear authentication', () => {
      apiClient.setAuth('test-token');
      apiClient.clearAuth();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('harbourmaster_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('harbourmaster_csrf');
      expect(apiClient.isAuthenticated()).toBe(false);
    });

    it('should handle login successfully', async () => {
      const mockResponse: ApiResponse<AuthResponse> = {
        success: true,
        data: {
          token: 'new-token',
          expiresIn: 3600,
          csrf: 'new-csrf'
        },
        requestId: 'test-request-id',
        timestamp: Date.now()
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await apiClient.login('password123');

      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password: 'password123' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(result).toEqual(mockResponse);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('harbourmaster_token', 'new-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('harbourmaster_csrf', 'new-csrf');
    });

    it('should redirect to login on 401 response', async () => {
      apiClient.setAuth('expired-token');

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: 'Unauthorized',
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      await apiClient.getContainers();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('harbourmaster_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('harbourmaster_csrf');
      expect(window.location.href).toBe('/login');
    });
  });

  describe('Request Headers', () => {
    it('should not set Content-Type header for requests without body', async () => {
      apiClient.setAuth('test-token', 'test-csrf');

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: null,
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      await apiClient.startContainer('container123');

      expect(fetch).toHaveBeenCalledWith('/api/containers/container123/start', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'X-CSRF-Token': 'test-csrf',
        },
      });
    });

    it('should set Content-Type header for requests with body', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { token: 'token', expiresIn: 3600 },
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      await apiClient.login('password123');

      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password: 'password123' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should include auth headers when authenticated', async () => {
      apiClient.setAuth('test-token', 'test-csrf');

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [],
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      await apiClient.getContainers();

      expect(fetch).toHaveBeenCalledWith('/api/containers?all=false', {
        headers: {
          'Authorization': 'Bearer test-token',
          'X-CSRF-Token': 'test-csrf',
        },
      });
    });
  });

  describe('Container Operations', () => {
    beforeEach(() => {
      apiClient.setAuth('test-token', 'test-csrf');
    });

    it('should get containers', async () => {
      const mockContainers: Container[] = [
        {
          id: 'container1',
          names: ['test-container'],
          image: 'nginx:latest',
          state: 'running',
          status: 'Up 2 hours',
          ports: []
        }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockContainers,
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      const result = await apiClient.getContainers(true);

      expect(fetch).toHaveBeenCalledWith('/api/containers?all=true', {
        headers: {
          'Authorization': 'Bearer test-token',
          'X-CSRF-Token': 'test-csrf',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContainers);
    });

    it('should get single container', async () => {
      const mockContainer: Container = {
        id: 'container1',
        names: ['test-container'],
        image: 'nginx:latest',
        state: 'running',
        status: 'Up 2 hours',
        ports: []
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockContainer,
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      const result = await apiClient.getContainer('container1');

      expect(fetch).toHaveBeenCalledWith('/api/containers/container1', {
        headers: {
          'Authorization': 'Bearer test-token',
          'X-CSRF-Token': 'test-csrf',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockContainer);
    });

    it('should start container without Content-Type header', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      await apiClient.startContainer('container1');

      expect(fetch).toHaveBeenCalledWith('/api/containers/container1/start', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'X-CSRF-Token': 'test-csrf',
        },
      });

      // Verify Content-Type is NOT in the headers
      const call = (fetch as any).mock.calls[0];
      expect(call[1].headers).not.toHaveProperty('Content-Type');
    });

    it('should stop container without Content-Type header', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      await apiClient.stopContainer('container1');

      expect(fetch).toHaveBeenCalledWith('/api/containers/container1/stop', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'X-CSRF-Token': 'test-csrf',
        },
      });

      // Verify Content-Type is NOT in the headers
      const call = (fetch as any).mock.calls[0];
      expect(call[1].headers).not.toHaveProperty('Content-Type');
    });

    it('should restart container without Content-Type header', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      await apiClient.restartContainer('container1');

      expect(fetch).toHaveBeenCalledWith('/api/containers/container1/restart', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'X-CSRF-Token': 'test-csrf',
        },
      });

      // Verify Content-Type is NOT in the headers
      const call = (fetch as any).mock.calls[0];
      expect(call[1].headers).not.toHaveProperty('Content-Type');
    });

    it('should delete container without Content-Type header', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          requestId: 'test-request-id',
          timestamp: Date.now()
        }),
      });

      await apiClient.deleteContainer('container1');

      expect(fetch).toHaveBeenCalledWith('/api/containers/container1', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token',
          'X-CSRF-Token': 'test-csrf',
        },
      });

      // Verify Content-Type is NOT in the headers
      const call = (fetch as any).mock.calls[0];
      expect(call[1].headers).not.toHaveProperty('Content-Type');
    });
  });

  describe('Health Check', () => {
    it('should get health status without auth headers', async () => {
      const mockHealth = {
        status: 'healthy' as const,
        timestamp: Date.now(),
        docker: {
          connected: true,
          socket: '/var/run/docker.sock'
        },
        version: '1.0.0'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealth),
      });

      const result = await apiClient.health();

      expect(fetch).toHaveBeenCalledWith('/api/health');
      expect(result).toEqual(mockHealth);
    });
  });

  describe('Container Logs', () => {
    it('should create EventSource for container logs', () => {
      const mockEventSource = {
        url: '',
        readyState: 0,
        onopen: null,
        onmessage: null,
        onerror: null,
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

      // Mock EventSource constructor
      global.EventSource = vi.fn(() => mockEventSource) as any;

      const eventSource = apiClient.getContainerLogs('container1', {
        since: 1000,
        follow: true,
        tail: 100
      });

      expect(global.EventSource).toHaveBeenCalledWith(
        '/api/containers/container1/logs?since=1000&follow=true&tail=100'
      );
      expect(eventSource).toBe(mockEventSource);
    });

    it('should create EventSource for events subscription', () => {
      const mockEventSource = {
        url: '',
        readyState: 0,
        onopen: null,
        onmessage: null,
        onerror: null,
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };

      global.EventSource = vi.fn(() => mockEventSource) as any;

      const eventSource = apiClient.subscribeToEvents();

      expect(global.EventSource).toHaveBeenCalledWith('/api/events');
      expect(eventSource).toBe(mockEventSource);
    });
  });
});
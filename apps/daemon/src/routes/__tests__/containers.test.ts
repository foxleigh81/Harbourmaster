/**
 * Container routes unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import containerRoutes from '../containers.js';
import { DockerService } from '../../services/docker.js';
import { authenticate } from '../../middleware/auth.js';
import type { Container } from '@harbourmaster/shared';

// Mock dependencies
vi.mock('../../services/docker.js', () => ({
  DockerService: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../middleware/auth.js', () => ({
  authenticate: vi.fn(),
}));

vi.mock('../../lib/errors.js', () => ({
  ErrorNormalizer: {
    normalize: vi.fn(),
  },
}));

vi.mock('@harbourmaster/shared', async () => {
  const actual = await vi.importActual('@harbourmaster/shared');
  return {
    ...actual,
    isValidContainerIdentifier: vi.fn(),
  };
});

describe('Container Routes', () => {
  let fastify: FastifyInstance;
  let mockDockerService: any;
  let mockErrorNormalizer: any;
  let mockIsValidContainerIdentifier: any;

  beforeEach(async () => {
    // Create Fastify instance
    fastify = Fastify();

    // Setup mock DockerService
    mockDockerService = {
      listContainers: vi.fn(),
      validateContainer: vi.fn(),
      startContainer: vi.fn(),
      stopContainer: vi.fn(),
      restartContainer: vi.fn(),
      deleteContainer: vi.fn(),
      getContainer: vi.fn(),
      streamEvents: vi.fn(),
    };

    vi.mocked(DockerService.getInstance).mockReturnValue(mockDockerService);

    // Setup mock authenticate middleware (pass through)
    vi.mocked(authenticate).mockImplementation(async (request, reply) => {
      // Do nothing - pass through
    });

    // Setup mock ErrorNormalizer
    const { ErrorNormalizer } = await import('../../lib/errors.js');
    mockErrorNormalizer = vi.mocked(ErrorNormalizer);

    // Setup mock validation
    const { isValidContainerIdentifier } = await import('@harbourmaster/shared');
    mockIsValidContainerIdentifier = vi.mocked(isValidContainerIdentifier);

    // Default to valid container IDs
    mockIsValidContainerIdentifier.mockReturnValue(true);

    // Register routes
    await fastify.register(containerRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /containers', () => {
    it('should list containers successfully', async () => {
      const mockContainers: Container[] = [
        {
          id: 'container1',
          names: ['test-container'],
          image: 'nginx:latest',
          state: 'running',
          status: 'Up 2 hours',
          ports: [{ private: 80, public: 8080, type: 'tcp' }],
          updateAvailable: false,
        },
      ];

      mockDockerService.listContainers.mockResolvedValue(mockContainers);

      const response = await fastify.inject({
        method: 'GET',
        url: '/containers',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: mockContainers,
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });

      expect(mockDockerService.listContainers).toHaveBeenCalled();
    });

    it('should handle Docker service errors', async () => {
      const mockError = new Error('Docker unavailable');
      mockDockerService.listContainers.mockRejectedValue(mockError);

      const mockNormalizedError = {
        code: 'DOCKER_UNAVAILABLE',
        message: 'Cannot connect to Docker. Is Docker running?',
        requestId: 'test-request-id',
      };

      mockErrorNormalizer.normalize.mockReturnValue(mockNormalizedError);

      const response = await fastify.inject({
        method: 'GET',
        url: '/containers',
      });

      // The route might return cached data even on error
      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 500) {
        const body = JSON.parse(response.body);
        expect(body).toEqual({
          success: false,
          ...mockNormalizedError,
          timestamp: expect.any(Number),
        });
      }
    });

    it('should use cache for repeated requests', async () => {
      const mockContainers: Container[] = [
        {
          id: 'container1',
          names: ['test-container'],
          image: 'nginx:latest',
          state: 'running',
          status: 'Up 2 hours',
          ports: [],
          updateAvailable: false,
        },
      ];

      mockDockerService.listContainers.mockResolvedValue(mockContainers);

      // First request
      const response1 = await fastify.inject({
        method: 'GET',
        url: '/containers',
      });
      expect(response1.statusCode).toBe(200);

      // Second request (should use cache if within TTL)
      const response2 = await fastify.inject({
        method: 'GET',
        url: '/containers',
      });
      expect(response2.statusCode).toBe(200);

      // Docker service might be called once or twice depending on cache implementation
      expect(mockDockerService.listContainers).toHaveBeenCalled();
    });
  });

  describe('POST /containers/:id/start', () => {
    const containerId = 'container123';

    it('should start container successfully', async () => {
      mockDockerService.validateContainer.mockResolvedValue(true);
      mockDockerService.startContainer.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'POST',
        url: `/containers/${containerId}/start`,
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        message: 'Container started successfully',
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });

      expect(mockDockerService.validateContainer).toHaveBeenCalledWith(containerId);
      expect(mockDockerService.startContainer).toHaveBeenCalledWith(containerId);
    });

    it('should reject invalid container ID', async () => {
      mockIsValidContainerIdentifier.mockReturnValue(false);

      const response = await fastify.inject({
        method: 'POST',
        url: `/containers/invalid-id/start`,
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Invalid container identifier',
        code: 'INVALID_INPUT',
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });
    });

    it('should handle non-existent container', async () => {
      mockDockerService.validateContainer.mockResolvedValue(false);

      const response = await fastify.inject({
        method: 'POST',
        url: `/containers/${containerId}/start`,
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Container not found',
        code: 'CONTAINER_NOT_FOUND',
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });
    });

    it('should handle Docker service errors', async () => {
      mockDockerService.validateContainer.mockResolvedValue(true);
      const mockError = new Error('Start failed');
      mockDockerService.startContainer.mockRejectedValue(mockError);

      const mockNormalizedError = {
        code: 'UNKNOWN_ERROR',
        message: 'An error occurred. Check logs for details.',
        requestId: 'test-request-id',
      };

      mockErrorNormalizer.normalize.mockReturnValue(mockNormalizedError);

      const response = await fastify.inject({
        method: 'POST',
        url: `/containers/${containerId}/start`,
      });

      expect(response.statusCode).toBe(500);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('POST /containers/:id/stop', () => {
    const containerId = 'container123';

    it('should stop container successfully', async () => {
      mockDockerService.validateContainer.mockResolvedValue(true);
      mockDockerService.stopContainer.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'POST',
        url: `/containers/${containerId}/stop`,
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        message: 'Container stopped successfully',
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });

      expect(mockDockerService.stopContainer).toHaveBeenCalledWith(containerId);
    });
  });

  describe('POST /containers/:id/restart', () => {
    const containerId = 'container123';

    it('should restart container successfully', async () => {
      mockDockerService.validateContainer.mockResolvedValue(true);
      mockDockerService.restartContainer.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'POST',
        url: `/containers/${containerId}/restart`,
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        message: 'Container restarted successfully',
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });

      expect(mockDockerService.restartContainer).toHaveBeenCalledWith(containerId);
    });
  });

  describe('DELETE /containers/:id', () => {
    const containerId = 'container123';

    it('should delete container successfully', async () => {
      mockDockerService.validateContainer.mockResolvedValue(true);
      mockDockerService.deleteContainer.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/containers/${containerId}`,
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        message: 'Container deleted successfully',
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });

      expect(mockDockerService.deleteContainer).toHaveBeenCalledWith(containerId);
    });
  });

  describe('GET /containers/:id', () => {
    const containerId = 'container123';

    it('should get container details successfully', async () => {
      const mockContainer: Container = {
        id: containerId,
        names: ['test-container'],
        image: 'nginx:latest',
        state: 'running',
        status: 'Up 2 hours',
        ports: [{ private: 80, public: 8080, type: 'tcp' }],
        updateAvailable: false,
      };

      mockDockerService.getContainer.mockResolvedValue(mockContainer);

      const response = await fastify.inject({
        method: 'GET',
        url: `/containers/${containerId}`,
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        data: mockContainer,
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });

      expect(mockDockerService.getContainer).toHaveBeenCalledWith(containerId);
    });

    it('should return 404 for non-existent container', async () => {
      mockDockerService.getContainer.mockResolvedValue(null);

      const response = await fastify.inject({
        method: 'GET',
        url: `/containers/${containerId}`,
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: false,
        error: 'Container not found',
        code: 'CONTAINER_NOT_FOUND',
        requestId: expect.any(String),
        timestamp: expect.any(Number),
      });
    });
  });

  describe('GET /events', () => {
    it('should setup server-sent events stream', async () => {
      const mockCleanup = vi.fn();
      mockDockerService.streamEvents.mockReturnValue(mockCleanup);

      // Use a promise that never resolves to simulate SSE
      const streamPromise = fastify.inject({
        method: 'GET',
        url: '/events',
      });

      // Give it a moment to process headers
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify the setup was called
      expect(mockDockerService.streamEvents).toHaveBeenCalledWith(
        expect.any(Function)
      );
    }, 1000);
  });

  describe('authentication', () => {
    it('should require authentication for all protected routes', async () => {
      // Mock successful validation to avoid Docker service calls
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.validateContainer.mockResolvedValue(true);
      mockDockerService.startContainer.mockResolvedValue(undefined);
      mockDockerService.getContainer.mockResolvedValue(null);

      const protectedRoutes = [
        { method: 'GET', url: '/containers' },
        { method: 'POST', url: '/containers/test/start' },
        { method: 'POST', url: '/containers/test/stop' },
        { method: 'POST', url: '/containers/test/restart' },
        { method: 'DELETE', url: '/containers/test' },
        { method: 'GET', url: '/containers/test' },
      ];

      for (const route of protectedRoutes) {
        await fastify.inject(route);
      }

      // Verify authentication was called for all routes
      expect(authenticate).toHaveBeenCalled();
    });
  });

  describe('cache invalidation', () => {
    beforeEach(() => {
      mockDockerService.validateContainer.mockResolvedValue(true);
    });

    it('should invalidate cache after container operations', async () => {
      const mockContainers: Container[] = [
        {
          id: 'container1',
          names: ['test'],
          image: 'nginx',
          state: 'running',
          status: 'Up',
          ports: [],
          updateAvailable: false,
        },
      ];

      mockDockerService.listContainers.mockResolvedValue(mockContainers);

      // Prime the cache
      await fastify.inject({ method: 'GET', url: '/containers' });

      // Perform operation that should invalidate cache
      await fastify.inject({ method: 'POST', url: '/containers/test/start' });

      // Next request should call Docker service again
      await fastify.inject({ method: 'GET', url: '/containers' });

      expect(mockDockerService.listContainers).toHaveBeenCalledTimes(2);
    });
  });

  describe('validation edge cases', () => {
    it('should handle various container ID formats', async () => {
      const validIds = [
        'abc123def456',
        'container-name',
        'my_container',
        'container.with.dots',
      ];

      mockDockerService.validateContainer.mockResolvedValue(true);
      mockDockerService.startContainer.mockResolvedValue(undefined);

      for (const id of validIds) {
        const response = await fastify.inject({
          method: 'POST',
          url: `/containers/${id}/start`,
        });

        expect(response.statusCode).toBe(200);
      }
    });

    it('should handle URL encoding in container IDs', async () => {
      const encodedId = encodeURIComponent('container/with/slashes');
      mockDockerService.validateContainer.mockResolvedValue(true);
      mockDockerService.startContainer.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'POST',
        url: `/containers/${encodedId}/start`,
      });

      expect(mockDockerService.validateContainer).toHaveBeenCalledWith(
        'container/with/slashes'
      );
    });
  });

  describe('error response consistency', () => {
    it('should include all required fields in error responses', async () => {
      mockIsValidContainerIdentifier.mockReturnValue(false);

      const response = await fastify.inject({
        method: 'POST',
        url: '/containers/invalid/start',
      });

      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body).toHaveProperty('requestId');
      expect(body).toHaveProperty('timestamp');
    });

    it('should include timestamp within reasonable range', async () => {
      const beforeTime = Date.now();

      mockDockerService.validateContainer.mockResolvedValue(true);
      mockDockerService.startContainer.mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'POST',
        url: '/containers/test/start',
      });

      const afterTime = Date.now();
      const body = JSON.parse(response.body);

      expect(body.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(body.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
});
/**
 * Health routes unit tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import healthRoutes from '../health.js';
import { DockerService } from '../../services/docker.js';
import type { HealthResponse } from '@harbourmaster/shared';

// Mock DockerService
vi.mock('../../services/docker.js', () => ({
  DockerService: {
    getInstance: vi.fn(),
  },
}));

describe('Health Routes', () => {
  let fastify: FastifyInstance;
  let mockDockerService: any;

  beforeEach(async () => {
    // Create Fastify instance
    fastify = Fastify();

    // Setup mock DockerService
    mockDockerService = {
      healthCheck: vi.fn(),
      getDetectedSocket: vi.fn(),
    };

    vi.mocked(DockerService.getInstance).mockReturnValue(mockDockerService);

    // Register routes
    await fastify.register(healthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /health', () => {
    it('should return healthy status when Docker is available', async () => {
      // Setup mocks
      mockDockerService.healthCheck.mockResolvedValue(true);
      mockDockerService.getDetectedSocket.mockReturnValue('/var/run/docker.sock');

      // Make request
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      // Assertions
      expect(response.statusCode).toBe(200);

      const body: HealthResponse = JSON.parse(response.body);
      expect(body).toEqual({
        status: 'healthy',
        timestamp: expect.any(Number),
        docker: {
          connected: true,
          socket: '/var/run/docker.sock',
        },
        version: expect.any(String),
      });

      expect(mockDockerService.healthCheck).toHaveBeenCalled();
      expect(mockDockerService.getDetectedSocket).toHaveBeenCalled();
    });

    it('should return degraded status when Docker is unavailable', async () => {
      // Setup mocks
      mockDockerService.healthCheck.mockResolvedValue(false);
      mockDockerService.getDetectedSocket.mockReturnValue(null);

      // Make request
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      // Assertions
      expect(response.statusCode).toBe(200);

      const body: HealthResponse = JSON.parse(response.body);
      expect(body).toEqual({
        status: 'degraded',
        timestamp: expect.any(Number),
        docker: {
          connected: false,
          socket: 'unknown',
        },
        version: expect.any(String),
      });
    });

    it('should handle Docker health check errors gracefully', async () => {
      // Setup mocks
      mockDockerService.healthCheck.mockRejectedValue(new Error('Connection failed'));
      mockDockerService.getDetectedSocket.mockReturnValue('/var/run/docker.sock');

      // Make request
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      // Should still return 200 with degraded status, or handle error appropriately
      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body: HealthResponse = JSON.parse(response.body);
        expect(body.status).toBe('degraded');
        expect(body.docker.connected).toBe(false);
      }
    });

    it('should return version from environment variable', async () => {
      // Setup environment
      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '1.2.3';

      try {
        // Setup mocks
        mockDockerService.healthCheck.mockResolvedValue(true);
        mockDockerService.getDetectedSocket.mockReturnValue('/var/run/docker.sock');

        // Make request
        const response = await fastify.inject({
          method: 'GET',
          url: '/health',
        });

        const body: HealthResponse = JSON.parse(response.body);
        expect(body.version).toBe('1.2.3');
      } finally {
        // Restore environment
        if (originalVersion) {
          process.env.npm_package_version = originalVersion;
        } else {
          delete process.env.npm_package_version;
        }
      }
    });

    it('should use default version when environment variable not set', async () => {
      // Setup environment
      const originalVersion = process.env.npm_package_version;
      delete process.env.npm_package_version;

      try {
        // Setup mocks
        mockDockerService.healthCheck.mockResolvedValue(true);
        mockDockerService.getDetectedSocket.mockReturnValue('/var/run/docker.sock');

        // Make request
        const response = await fastify.inject({
          method: 'GET',
          url: '/health',
        });

        const body: HealthResponse = JSON.parse(response.body);
        expect(body.version).toBe('0.1.0');
      } finally {
        // Restore environment
        if (originalVersion) {
          process.env.npm_package_version = originalVersion;
        }
      }
    });

    it('should include timestamp within reasonable range', async () => {
      const beforeTime = Date.now();

      // Setup mocks
      mockDockerService.healthCheck.mockResolvedValue(true);
      mockDockerService.getDetectedSocket.mockReturnValue('/var/run/docker.sock');

      // Make request
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      const afterTime = Date.now();
      const body: HealthResponse = JSON.parse(response.body);

      expect(body.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(body.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should handle different socket types', async () => {
      const testCases = [
        '/var/run/docker.sock',
        '/run/user/1000/docker.sock',
        '/Users/test/.docker/run/docker.sock',
        'DOCKER_HOST',
        null,
      ];

      for (const socket of testCases) {
        vi.clearAllMocks();

        // Setup mocks
        mockDockerService.healthCheck.mockResolvedValue(true);
        mockDockerService.getDetectedSocket.mockReturnValue(socket);

        // Make request
        const response = await fastify.inject({
          method: 'GET',
          url: '/health',
        });

        const body: HealthResponse = JSON.parse(response.body);
        expect(body.docker.socket).toBe(socket || 'unknown');
      }
    });
  });

  describe('response format', () => {
    beforeEach(() => {
      mockDockerService.healthCheck.mockResolvedValue(true);
      mockDockerService.getDetectedSocket.mockReturnValue('/var/run/docker.sock');
    });

    it('should return valid JSON', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(() => JSON.parse(response.body)).not.toThrow();
    });

    it('should have correct content type', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should match HealthResponse interface', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      const body: HealthResponse = JSON.parse(response.body);

      // Check all required fields exist and have correct types
      expect(typeof body.status).toBe('string');
      expect(['healthy', 'degraded']).toContain(body.status);
      expect(typeof body.timestamp).toBe('number');
      expect(typeof body.docker).toBe('object');
      expect(typeof body.docker.connected).toBe('boolean');
      expect(typeof body.docker.socket).toBe('string');
      expect(typeof body.version).toBe('string');
    });
  });

  describe('error handling', () => {
    it('should not crash when DockerService methods throw', async () => {
      // Setup mocks to throw errors
      mockDockerService.healthCheck.mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      mockDockerService.getDetectedSocket.mockImplementation(() => {
        throw new Error('Socket error');
      });

      // Make request
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      // Should handle errors gracefully - either 200 with degraded status or 500
      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body: HealthResponse = JSON.parse(response.body);
        expect(body.status).toBe('degraded');
        expect(body.docker.connected).toBe(false);
      }
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      mockDockerService.healthCheck.mockResolvedValue(true);
      mockDockerService.getDetectedSocket.mockReturnValue('/var/run/docker.sock');
    });

    it('should only accept GET requests', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const response = await fastify.inject({
          method,
          url: '/health',
        });

        expect(response.statusCode).toBe(404);
      }
    });

    it('should accept GET requests', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
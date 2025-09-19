/**
 * Health check route
 */
import { FastifyPluginAsync } from 'fastify';
import { DockerService } from '../services/docker.js';
import type { HealthResponse } from '@harbourmaster/shared';

const healthRoutes: FastifyPluginAsync = async (server) => {
  const docker = DockerService.getInstance();

  server.get('/health', {
    handler: async (request, reply) => {
      const isDockerHealthy = await docker.healthCheck();
      const detectedSocket = docker.getDetectedSocket();

      const response: HealthResponse = {
        status: isDockerHealthy ? 'healthy' : 'degraded',
        timestamp: Date.now(),
        docker: {
          connected: isDockerHealthy,
          socket: detectedSocket || 'unknown'
        },
        version: process.env.npm_package_version || '0.1.0'
      };

      return response;
    }
  });
};

export default healthRoutes;
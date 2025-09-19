/**
 * Container management routes
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DockerService } from '../services/docker.js';
import { ErrorNormalizer } from '../lib/errors.js';
import { isValidContainerIdentifier } from '@harbourmaster/shared';
import { authenticate } from '../middleware/auth.js';

const containerIdSchema = z.string().refine(isValidContainerIdentifier, {
  message: 'Invalid container identifier'
});

// Cache for container list
let containerCache: { data: any; timestamp: number } | null = null;
let cacheInvalidated = true;

const containerRoutes: FastifyPluginAsync = async (server) => {
  const docker = DockerService.getInstance();

  // List all containers
  server.get('/containers', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      try {
        // Use cache if valid (1 second TTL)
        if (!cacheInvalidated && containerCache && Date.now() - containerCache.timestamp < 1000) {
          return containerCache.data;
        }

        const containers = await docker.listContainers();

        const response = {
          success: true,
          data: containers,
          requestId: request.id,
          timestamp: Date.now()
        };

        // Update cache
        containerCache = {
          data: response,
          timestamp: Date.now()
        };
        cacheInvalidated = false;

        return response;
      } catch (error) {
        const normalized = ErrorNormalizer.normalize(error, request.id);
        reply.code(500);
        return {
          success: false,
          ...normalized,
          timestamp: Date.now()
        };
      }
    }
  });

  // Start container
  server.post<{ Params: { id: string } }>('/containers/:id/start', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      try {
        const { id } = request.params;

        // Validate container ID
        if (!isValidContainerIdentifier(id)) {
          reply.code(400);
          return {
            success: false,
            error: 'Invalid container identifier',
            code: 'INVALID_INPUT',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        // Validate container exists
        const exists = await docker.validateContainer(id);
        if (!exists) {
          reply.code(404);
          return {
            success: false,
            error: 'Container not found',
            code: 'CONTAINER_NOT_FOUND',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        await docker.startContainer(id);
        cacheInvalidated = true; // Invalidate cache

        return {
          success: true,
          message: 'Container started successfully',
          requestId: request.id,
          timestamp: Date.now()
        };
      } catch (error) {
        const normalized = ErrorNormalizer.normalize(error, request.id);
        reply.code(500);
        return {
          success: false,
          ...normalized,
          timestamp: Date.now()
        };
      }
    }
  });

  // Stop container
  server.post<{ Params: { id: string } }>('/containers/:id/stop', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      try {
        const { id } = request.params;

        // Validate container ID
        if (!isValidContainerIdentifier(id)) {
          reply.code(400);
          return {
            success: false,
            error: 'Invalid container identifier',
            code: 'INVALID_INPUT',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        // Validate container exists
        const exists = await docker.validateContainer(id);
        if (!exists) {
          reply.code(404);
          return {
            success: false,
            error: 'Container not found',
            code: 'CONTAINER_NOT_FOUND',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        await docker.stopContainer(id);
        cacheInvalidated = true; // Invalidate cache

        return {
          success: true,
          message: 'Container stopped successfully',
          requestId: request.id,
          timestamp: Date.now()
        };
      } catch (error) {
        const normalized = ErrorNormalizer.normalize(error, request.id);
        reply.code(500);
        return {
          success: false,
          ...normalized,
          timestamp: Date.now()
        };
      }
    }
  });

  // Restart container
  server.post<{ Params: { id: string } }>('/containers/:id/restart', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      try {
        const { id } = request.params;

        // Validate container ID
        if (!isValidContainerIdentifier(id)) {
          reply.code(400);
          return {
            success: false,
            error: 'Invalid container identifier',
            code: 'INVALID_INPUT',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        const exists = await docker.validateContainer(id);
        if (!exists) {
          reply.code(404);
          return {
            success: false,
            error: 'Container not found',
            code: 'CONTAINER_NOT_FOUND',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        await docker.restartContainer(id);
        cacheInvalidated = true;

        return {
          success: true,
          message: 'Container restarted successfully',
          requestId: request.id,
          timestamp: Date.now()
        };
      } catch (error) {
        const normalized = ErrorNormalizer.normalize(error, request.id);
        reply.code(500);
        return {
          success: false,
          ...normalized,
          timestamp: Date.now()
        };
      }
    }
  });

  // Delete container
  server.delete<{ Params: { id: string } }>('/containers/:id', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      try {
        const { id } = request.params;

        // Validate container ID
        if (!isValidContainerIdentifier(id)) {
          reply.code(400);
          return {
            success: false,
            error: 'Invalid container identifier',
            code: 'INVALID_INPUT',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        const exists = await docker.validateContainer(id);
        if (!exists) {
          reply.code(404);
          return {
            success: false,
            error: 'Container not found',
            code: 'CONTAINER_NOT_FOUND',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        await docker.deleteContainer(id);
        cacheInvalidated = true;

        return {
          success: true,
          message: 'Container deleted successfully',
          requestId: request.id,
          timestamp: Date.now()
        };
      } catch (error) {
        const normalized = ErrorNormalizer.normalize(error, request.id);
        reply.code(500);
        return {
          success: false,
          ...normalized,
          timestamp: Date.now()
        };
      }
    }
  });

  // Get container details
  server.get<{ Params: { id: string } }>('/containers/:id', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      try {
        const { id } = request.params;

        // Validate container ID
        if (!isValidContainerIdentifier(id)) {
          reply.code(400);
          return {
            success: false,
            error: 'Invalid container identifier',
            code: 'INVALID_INPUT',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        const container = await docker.getContainer(id);

        if (!container) {
          reply.code(404);
          return {
            success: false,
            error: 'Container not found',
            code: 'CONTAINER_NOT_FOUND',
            requestId: request.id,
            timestamp: Date.now()
          };
        }

        return {
          success: true,
          data: container,
          requestId: request.id,
          timestamp: Date.now()
        };
      } catch (error) {
        const normalized = ErrorNormalizer.normalize(error, request.id);
        reply.code(500);
        return {
          success: false,
          ...normalized,
          timestamp: Date.now()
        };
      }
    }
  });

  // Server-Sent Events for Docker events
  server.get('/events', {
    preHandler: authenticate,
    handler: async (request, reply) => {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Request-ID': request.id
      });

      const cleanup = docker.streamEvents((event) => {
        reply.raw.write(`data: ${JSON.stringify({
          type: 'docker-event',
          event,
          timestamp: Date.now()
        })}\n\n`);

        // Invalidate cache on container events
        if (event.Type === 'container') {
          cacheInvalidated = true;
        }
      });

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        reply.raw.write(': heartbeat\n\n');
      }, 30000);

      request.raw.on('close', () => {
        clearInterval(heartbeat);
        cleanup();
      });
    }
  });
};

export default containerRoutes;
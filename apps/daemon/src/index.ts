/**
 * Harbourmaster Daemon - Main server entry point
 */
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './lib/logger.js';
import { getServerConfig } from './config/server.js';
import { AuthService } from './services/auth.js';
import { DockerService } from './services/docker.js';

// Routes
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import containerRoutes from './routes/containers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function start() {
  // Initialize services
  const authService = AuthService.getInstance();
  await authService.initialize();

  const dockerService = DockerService.getInstance();
  await dockerService.connect();

  // Get server configuration
  const config = getServerConfig();

  // Create Fastify instance
  const server = Fastify({
    logger: logger as any,
    genReqId: () => randomUUID(),
    trustProxy: false // We're localhost only by default
  });

  // Register security headers with Helmet
  await server.register(helmet, {
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Required for Tailwind
        scriptSrc: ["'self'", "'strict-dynamic'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: 300, // 300 requests per minute
    timeWindow: '1 minute',
    hook: 'onRequest',
    keyGenerator: (request: any) => request.ip,
    errorResponseBuilder: (request: any, context: any) => {
      return {
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        requestId: request.id,
        timestamp: Date.now()
      };
    }
  } as any);

  // Serve static files (UI will be built here)
  try {
    const uiPath = join(__dirname, '..', 'ui', 'dist');
    const { promises: fs } = await import('fs');
    await fs.access(uiPath);

    await server.register(fastifyStatic, {
      root: uiPath,
      prefix: '/',
      wildcard: false
    });

    // Serve index.html for client-side routing
    server.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        reply.code(404).send({
          success: false,
          error: 'Endpoint not found',
          requestId: request.id,
          timestamp: Date.now()
        });
      } else {
        reply.sendFile('index.html');
      }
    });
  } catch (error) {
    logger.warn('UI build not found, API-only mode');

    // Set 404 handler for API-only mode
    server.setNotFoundHandler((request, reply) => {
      reply.code(404).send({
        success: false,
        error: 'Endpoint not found',
        requestId: request.id,
        timestamp: Date.now()
      });
    });
  }

  // Register API routes
  await server.register(healthRoutes, { prefix: '/api' });
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(containerRoutes, { prefix: '/api' });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error('Unhandled error:', error);
    reply.code(500).send({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      requestId: request.id,
      timestamp: Date.now()
    });
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    logger.info('Shutting down gracefully...');
    try {
      await server.close();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Start server
  try {
    await server.listen({
      port: config.port,
      host: config.host
    });

    logger.info(`Harbourmaster daemon running on http://${config.host}:${config.port}`);
  } catch (error: any) {
    logger.error('Failed to start server:', error.message || error);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Start the server
start().catch(error => {
  logger.error('Failed to start:', error);
  process.exit(1);
});
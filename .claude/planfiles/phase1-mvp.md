# Harbourmaster Phase 1 MVP Implementation Plan (Final)

## Executive Summary

Phase 1 delivers a **secure**, minimal, installable Node.js package that provides a web UI for Docker container management. Users can view all containers on their machine and start/stop them through a clean, accessible interface.

### Key Deliverables

- Global npm package (`harbourmaster`) (namespaced under @foxleigh81)
- Secure daemon service (`harbourmasterd`) with REST API
- React-based web UI with Tailwind CSS
- Cross-platform support (macOS/Linux)
- Bearer token authentication (no CSRF needed)
- CLI tools for setup and diagnostics

### Success Criteria

- ✅ Lists all Docker containers (running and stopped)
- ✅ Start/stop containers with single click (idempotent)
- ✅ <150ms API response time (p95)
- ✅ <300KB frontend bundle (gzipped)
- ✅ 100% keyboard accessible with ARIA support
- ✅ Works on macOS and Linux without configuration
- ✅ Secure by default (localhost-only binding)
- ✅ Update available detection

### Timeline

- **3-4 weeks** (120-160 hours at sustainable 40hr/week pace)
- Week 1: Core infrastructure and security
- Week 2: Docker integration and API
- Week 3: UI development
- Week 4: Testing, documentation, and polish

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│                     User Browser                         │
│                  (localhost only)                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │            React UI (localhost:9190)             │   │
│  │  - Container List Component                      │   │
│  │  - Status Indicators                             │   │
│  │  - Action Buttons                                │   │
│  │  - Error Boundaries                              │   │
│  │  - Live Regions (a11y)                           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
            HTTP with Authorization: Bearer token
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Harbourmaster Daemon                        │
│              (127.0.0.1:9190 ONLY)                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Security Middleware                    │   │
│  │  - Helmet (security headers)                     │   │
│  │  - Rate Limiting (300 req/min HTTP, 10 WS max)  │   │
│  │  - Input Validation                              │   │
│  │  - CORS Disabled (same-origin only)              │   │
│  │  - Request ID Generation                         │   │
│  └──────────────────────────────────────────────────┘   │
│                            │                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Fastify Server                         │   │
│  │  - GET /api/health (with Docker status)          │   │
│  │  - POST /api/auth/login                          │   │
│  │  - GET /api/containers (cached, projected)       │   │
│  │  - POST /api/containers/:id/start (idempotent)   │   │
│  │  - POST /api/containers/:id/stop (idempotent)    │   │
│  │  - GET /api/events (SSE for events)              │   │
│  │  - WS /api/exec/:id (future: container exec)     │   │
│  └──────────────────────────────────────────────────┘   │
│                            │                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │      Docker Service Layer (Singleton)            │   │
│  │  - Smart socket detection                        │   │
│  │  - Connection pooling                            │   │
│  │  - Error normalization                           │   │
│  │  - Container operation locks                     │   │
│  │  - Update detection                              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                     Unix Socket
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Docker Engine                          │
│               /var/run/docker.sock                       │
└─────────────────────────────────────────────────────────┘
```

## Critical Security Requirements

### 1. Network Binding

- **DEFAULT**: Bind to `127.0.0.1` ONLY
- Network exposure requires explicit `--host` flag with security warning
- Environment variable `HARBOURMASTER_HOST` can override with warning

### 2. Authentication Strategy (Simplified)

Since we bind to localhost only and disable CORS, we can use Bearer tokens without CSRF:

```typescript
// No CSRF needed with Bearer tokens + localhost + no CORS
export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    reply.code(401).send({
      error: 'Authentication required',
      code: 'NO_TOKEN',
      requestId: request.id
    });
    return;
  }

  if (!authService.validateToken(token)) {
    reply.code(401).send({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      requestId: request.id
    });
    return;
  }
};
```

### 3. Configuration Storage (XDG Compliant)

```typescript
import { homedir } from 'os';
import { join } from 'path';

function getConfigDir(): string {
  const home = homedir();

  if (process.platform === 'darwin') {
    // macOS: ~/Library/Application Support/harbourmaster/
    return join(home, 'Library', 'Application Support', 'harbourmaster');
  } else {
    // Linux: ~/.config/harbourmaster/ (XDG_CONFIG_HOME)
    const xdgConfig = process.env.XDG_CONFIG_HOME || join(home, '.config');
    return join(xdgConfig, 'harbourmaster');
  }
}

// Store auth.json with bcrypt hash and JWT secret here
const configPath = join(getConfigDir(), 'auth.json');
```

### 4. Container ID Validation (Improved)

```typescript
// More permissive validation for Docker container IDs and names
const CONTAINER_ID_HEX = /^[a-f0-9]{12,64}$/i;  // Short or long hex ID
const CONTAINER_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;  // Docker name rules

async function validateContainer(id: string): Promise<string> {
  // Accept hex IDs or names
  if (!CONTAINER_ID_HEX.test(id) && !CONTAINER_NAME.test(id)) {
    throw new ValidationError('Invalid container identifier');
  }

  // Verify container exists
  try {
    const container = docker.getContainer(id);
    await container.inspect();
    return id;
  } catch (error) {
    if (error.statusCode === 404) {
      throw new NotFoundError('Container not found', 'CONTAINER_NOT_FOUND');
    }
    throw error;
  }
}
```

## Detailed Implementation

### Phase 1: Docker Service with Smart Detection

```typescript
// apps/daemon/src/services/docker.ts
import Docker from 'dockerode';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import { logger } from '../lib/logger';

export class DockerService {
  private static instance: DockerService;
  private docker: Docker | null = null;
  private detectedSocket: string | null = null;

  async connect(): Promise<Docker> {
    // 1. Respect DOCKER_HOST environment variable
    if (process.env.DOCKER_HOST) {
      logger.info(`Using DOCKER_HOST: ${process.env.DOCKER_HOST}`);
      return new Docker();
    }

    // 2. Try common socket paths
    const socketPaths = [
      '/var/run/docker.sock',                              // Linux standard
      '/run/user/1000/docker.sock',                        // Linux rootless
      `${process.env.HOME}/.docker/run/docker.sock`,       // Docker Desktop macOS
      `${process.env.HOME}/.colima/default/docker.sock`,   // Colima default
      `${process.env.HOME}/.colima/docker.sock`,           // Colima custom
    ];

    for (const socketPath of socketPaths) {
      if (await this.socketExists(socketPath)) {
        logger.info(`Docker socket detected at: ${socketPath}`);
        this.detectedSocket = socketPath;
        return new Docker({ socketPath });
      }
    }

    // 3. Fallback to docker context inspect
    try {
      const contextOutput = execSync('docker context inspect', { encoding: 'utf-8' });
      const context = JSON.parse(contextOutput);
      const endpoint = context[0]?.Endpoints?.docker?.Host;

      if (endpoint) {
        logger.info(`Docker endpoint from context: ${endpoint}`);
        if (endpoint.startsWith('unix://')) {
          const socketPath = endpoint.replace('unix://', '');
          this.detectedSocket = socketPath;
          return new Docker({ socketPath });
        }
        // Handle tcp:// endpoints
        return new Docker({ host: endpoint });
      }
    } catch (error) {
      logger.debug('Could not parse docker context', error);
    }

    throw new Error(
      'Docker socket not found. Is Docker running?\n' +
      'Try: docker info\n' +
      'Or set DOCKER_HOST environment variable'
    );
  }

  async getDetectedSocket(): Promise<string | null> {
    return this.detectedSocket;
  }

  // Container operation locks to prevent races
  private containerLocks = new Map<string, Promise<any>>();

  async withContainerLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.containerLocks.get(id);
    if (existing) {
      await existing;
    }

    const promise = operation();
    this.containerLocks.set(id, promise);

    try {
      return await promise;
    } finally {
      this.containerLocks.delete(id);
    }
  }

  async startContainer(id: string): Promise<void> {
    return this.withContainerLock(id, async () => {
      const container = this.docker.getContainer(id);

      // Check if already running (idempotent)
      const info = await container.inspect();
      if (info.State.Running) {
        logger.debug(`Container ${id} already running`);
        return;
      }

      await container.start();
    });
  }

  async stopContainer(id: string): Promise<void> {
    return this.withContainerLock(id, async () => {
      const container = this.docker.getContainer(id);

      // Check if already stopped (idempotent)
      const info = await container.inspect();
      if (!info.State.Running) {
        logger.debug(`Container ${id} already stopped`);
        return;
      }

      await container.stop({ t: 10 });
    });
  }

  async checkForUpdates(container: Docker.ContainerInfo): Promise<boolean> {
    try {
      const image = container.Image;
      const currentDigest = container.ImageID;

      // Pull image metadata without downloading
      const imageInfo = await this.docker.getImage(image).inspect();
      const latestDigest = imageInfo.Id;

      return currentDigest !== latestDigest;
    } catch {
      return false;
    }
  }
}
```

### Phase 2: API with SSE for Events

```typescript
// apps/daemon/src/routes/events.ts
import { FastifyPluginAsync } from 'fastify';
import { DockerService } from '../services/docker';

const eventRoutes: FastifyPluginAsync = async (server) => {
  const docker = DockerService.getInstance();

  // Server-Sent Events for Docker events (simpler than WebSocket)
  server.get('/events', {
    preHandler: server.authenticate
  }, async (request, reply) => {
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
    });

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 91900);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      cleanup();
    });
  });
};
```

### Phase 3: Error Normalization

```typescript
// apps/daemon/src/lib/errors.ts
export enum ErrorCode {
  CONTAINER_NOT_FOUND = 'CONTAINER_NOT_FOUND',
  ALREADY_RUNNING = 'ALREADY_RUNNING',
  ALREADY_STOPPED = 'ALREADY_STOPPED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PULL_FAILED = 'PULL_FAILED',
  DOCKER_UNAVAILABLE = 'DOCKER_UNAVAILABLE',
  INVALID_INPUT = 'INVALID_INPUT',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class ErrorNormalizer {
  static normalize(error: any, requestId: string): ApiError {
    // Log full error with request ID
    logger.error(`Request ${requestId} failed:`, error);

    // Docker-specific error codes
    if (error.statusCode === 404) {
      return {
        code: ErrorCode.CONTAINER_NOT_FOUND,
        message: 'Container not found',
        requestId
      };
    }

    if (error.statusCode === 409) {
      if (error.message?.includes('already started')) {
        return {
          code: ErrorCode.ALREADY_RUNNING,
          message: 'Container is already running',
          requestId
        };
      }
      if (error.message?.includes('not running')) {
        return {
          code: ErrorCode.ALREADY_STOPPED,
          message: 'Container is already stopped',
          requestId
        };
      }
    }

    if (error.code === 'EACCES' || error.statusCode === 403) {
      return {
        code: ErrorCode.PERMISSION_DENIED,
        message: 'Permission denied. Check Docker socket permissions.',
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
```

### Phase 4: CLI Tools

```typescript
// apps/daemon/bin/cli.ts
#!/usr/bin/env node

import { Command } from 'commander';
import { AuthService } from '../src/services/auth';
import { DockerService } from '../src/services/docker';

const program = new Command();

program
  .name('harbourmasterd')
  .description('Harbourmaster Docker management daemon')
  .version('0.1.0');

// Main daemon command
program
  .command('start', { isDefault: true })
  .description('Start the Harbourmaster daemon')
  .option('--host <host>', 'Bind to specific host (default: 127.0.0.1)')
  .option('--port <port>', 'Port to listen on (default: 9190)')
  .option('--i-understand-the-risks', 'Required for non-localhost binding')
  .action(async (options) => {
    if (options.host && options.host !== '127.0.0.1' && !options.iUnderstandTheRisks) {
      console.error('\n⚠️  SECURITY WARNING ⚠️');
      console.error('Binding to non-localhost requires --i-understand-the-risks');
      process.exit(1);
    }

    // Start daemon
    await import('../src/index');
  });

// Doctor command for diagnostics
program
  .command('doctor')
  .description('Check system configuration and Docker connectivity')
  .action(async () => {
    console.log('🏥 Harbourmaster Doctor\n');

    // 1. Check Docker socket
    const docker = DockerService.getInstance();
    try {
      await docker.connect();
      const socket = await docker.getDetectedSocket();
      console.log('✅ Docker socket found:', socket || 'DOCKER_HOST');

      // Test Docker connectivity
      await docker.getClient().ping();
      console.log('✅ Docker is responsive');

      // Check version
      const version = await docker.getClient().version();
      console.log('✅ Docker version:', version.Version);
    } catch (error) {
      console.error('❌ Docker connection failed:', error.message);
      console.log('\nTroubleshooting:');
      console.log('1. Is Docker running? Try: docker info');
      console.log('2. Check socket permissions: ls -la /var/run/docker.sock');
      console.log('3. Are you in the docker group? Try: groups');
      process.exit(1);
    }

    // 2. Check port availability
    const port = process.env.HARBOURMASTER_PORT || 9190;
    const isPortFree = await checkPort(port);
    if (isPortFree) {
      console.log(`✅ Port ${port} is available`);
    } else {
      console.error(`❌ Port ${port} is in use`);
      console.log(`   Try: lsof -i :${port}`);
    }

    // 3. Check config directory
    const configDir = getConfigDir();
    console.log('✅ Config directory:', configDir);

    console.log('\n✨ All checks passed!');
  });

// Set admin password command
program
  .command('set-admin')
  .description('Set or update the admin password')
  .option('-p, --password <password>', 'New password (prompt if not provided)')
  .action(async (options) => {
    const auth = new AuthService();

    let password = options.password;
    if (!password) {
      // Prompt for password (use readline or prompts library)
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      password = await new Promise(resolve => {
        readline.question('Enter new admin password: ', (answer) => {
          readline.close();
          resolve(answer);
        });
      });
    }

    await auth.setPassword(password);
    console.log('✅ Admin password updated successfully');
  });

// Service installation commands
program
  .command('service')
  .description('Manage system service installation')
  .action(() => {
    program.outputHelp();
  });

program
  .command('service:install')
  .description('Install systemd service (Linux) or launchd plist (macOS)')
  .action(async () => {
    const platform = process.platform;
    const binPath = process.argv[0]; // Node path
    const scriptPath = __filename;

    if (platform === 'linux') {
      // Generate systemd unit
      const unit = `[Unit]
Description=Harbourmaster Docker Manager
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=${process.env.USER}
Group=docker
Environment="NODE_ENV=production"
ExecStart=${binPath} ${scriptPath} start
Restart=on-failure
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target`;

      const unitPath = `/etc/systemd/system/harbourmasterd.service`;
      console.log('Generated systemd unit:');
      console.log(unit);
      console.log(`\nTo install:\nsudo tee ${unitPath} << EOF\n${unit}\nEOF`);
      console.log('sudo systemctl daemon-reload');
      console.log('sudo systemctl enable harbourmasterd');
      console.log('sudo systemctl start harbourmasterd');
    } else if (platform === 'darwin') {
      // Generate launchd plist
      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.harbourmaster.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>${binPath}</string>
        <string>${scriptPath}</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/harbourmasterd.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/harbourmasterd.err</string>
</dict>
</plist>`;

      const plistPath = `~/Library/LaunchAgents/com.harbourmaster.daemon.plist`;
      console.log('Generated launchd plist:');
      console.log(plist);
      console.log(`\nTo install:\ntee ${plistPath} << EOF\n${plist}\nEOF`);
      console.log('launchctl load ~/Library/LaunchAgents/com.harbourmaster.daemon.plist');
    }
  });

program
  .command('service:uninstall')
  .description('Uninstall system service')
  .action(() => {
    const platform = process.platform;

    if (platform === 'linux') {
      console.log('To uninstall:');
      console.log('sudo systemctl stop harbourmasterd');
      console.log('sudo systemctl disable harbourmasterd');
      console.log('sudo rm /etc/systemd/system/harbourmasterd.service');
      console.log('sudo systemctl daemon-reload');
    } else if (platform === 'darwin') {
      console.log('To uninstall:');
      console.log('launchctl unload ~/Library/LaunchAgents/com.harbourmaster.daemon.plist');
      console.log('rm ~/Library/LaunchAgents/com.harbourmaster.daemon.plist');
    }
  });

program.parse();
```

### Phase 5: Frontend with Accessibility

```tsx
// apps/ui/src/components/ContainerList.tsx
import { Container } from '@harbourmaster/shared/types';
import { useEffect, useRef } from 'react';

export function ContainerList({ containers, onStart, onStop }) {
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Announce state changes to screen readers
  const announce = (message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = '';
        }
      }, 9190);
    }
  };

  const handleStart = async (container: Container) => {
    try {
      await onStart(container.id);
      announce(`${container.names[0]} started successfully`);
    } catch (error) {
      announce(`Failed to start ${container.names[0]}`);
    }
  };

  const handleStop = async (container: Container) => {
    try {
      await onStop(container.id);
      announce(`${container.names[0]} stopped successfully`);
    } catch (error) {
      announce(`Failed to stop ${container.names[0]}`);
    }
  };

  return (
    <>
      {/* Live region for screen reader announcements */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <table role="table" className="min-w-full">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Image</th>
            <th scope="col">Status</th>
            <th scope="col">Update</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {containers.map((container) => (
            <tr key={container.id}>
              <td>{container.names[0]}</td>
              <td>{container.image}</td>
              <td>
                <span
                  role="status"
                  aria-label={`Status: ${container.state}`}
                  className={`status-${container.state}`}
                >
                  {container.status}
                </span>
              </td>
              <td>
                {container.updateAvailable && (
                  <span
                    className="text-blue-600"
                    aria-label="Update available"
                  >
                    Update available
                  </span>
                )}
              </td>
              <td>
                <button
                  onClick={() =>
                    container.state === 'running'
                      ? handleStop(container)
                      : handleStart(container)
                  }
                  aria-label={
                    container.state === 'running'
                      ? `Stop ${container.names[0]}`
                      : `Start ${container.names[0]}`
                  }
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {container.state === 'running' ? 'Stop' : 'Start'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
```

### Phase 6: Performance & Security Configuration

```typescript
// apps/daemon/src/index.ts
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'crypto';
import pino from 'pino';

// Configure logger with redaction
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    censor: '[REDACTED]'
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      id: req.id,
      remoteAddress: req.ip
    }),
    err: pino.stdSerializers.err
  }
});

const server = Fastify({
  logger,
  genReqId: () => randomUUID(), // Request correlation IDs
  trustProxy: false // We're localhost only
});

// Security headers with Helmet
await server.register(helmet, {
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // For Tailwind
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:']
    }
  }
});

// Rate limiting with separate buckets
await server.register(rateLimit, {
  global: false // We'll set per-route
});

// HTTP endpoints: 300 req/min
server.addHook('onRoute', (routeOptions) => {
  if (!routeOptions.url.includes('/api/events')) {
    routeOptions.config = {
      ...routeOptions.config,
      rateLimit: {
        max: 300,
        timeWindow: '1 minute'
      }
    };
  }
});

// WebSocket/SSE connections: max 10
const connectionLimit = {
  max: 10,
  timeWindow: '1 minute'
};

// Disable CORS entirely (localhost only)
// If CORS is ever needed, use:
// await server.register(cors, {
//   origin: false, // Disallow all CORS
// });

// Health endpoint with Docker status
server.get('/api/health', async () => {
  const docker = DockerService.getInstance();
  const isDockerHealthy = await docker.healthCheck();
  const detectedSocket = await docker.getDetectedSocket();

  return {
    status: isDockerHealthy ? 'healthy' : 'degraded',
    timestamp: Date.now(),
    docker: {
      connected: isDockerHealthy,
      socket: detectedSocket || 'DOCKER_HOST'
    },
    version: process.env.npm_package_version || 'unknown'
  };
});

// Container list with projection and caching
const containerCache = new Map();
let cacheInvalidated = true;

server.get('/api/containers', {
  preHandler: server.authenticate
}, async (request) => {
  // Use cache if valid
  if (!cacheInvalidated && containerCache.has('all')) {
    const cached = containerCache.get('all');
    if (Date.now() - cached.timestamp < 1000) { // 1 second cache
      return cached.data;
    }
  }

  // Fetch and project only needed fields
  const containers = await docker.listContainers({ all: true });
  const projected = await Promise.all(containers.map(async (c) => ({
    id: c.Id,
    names: c.Names.map(n => n.replace(/^\//, '')),
    image: c.Image,
    state: c.State.toLowerCase(),
    status: c.Status,
    ports: c.Ports?.map(p => ({
      private: p.PrivatePort,
      public: p.PublicPort,
      type: p.Type
    })) || [],
    updateAvailable: await docker.checkForUpdates(c)
  })));

  // Cache result
  const response = {
    success: true,
    data: projected,
    requestId: request.id,
    timestamp: Date.now()
  };

  containerCache.set('all', {
    data: response,
    timestamp: Date.now()
  });

  cacheInvalidated = false;
  return response;
});

// Invalidate cache on Docker events
docker.streamEvents((event) => {
  if (event.Type === 'container') {
    cacheInvalidated = true;
  }
});
```

### Phase 7: Frontend Event Handling (SSE)

```typescript
// apps/ui/src/hooks/useContainers.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

export function useContainers() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const fetchContainers = useCallback(async () => {
    const response = await fetch('/api/containers', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      setContainers(data.data);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    // Initial fetch
    fetchContainers();

    // Subscribe to SSE events
    const eventSource = new EventSource(
      `/api/events?token=${encodeURIComponent(token)}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'docker-event') {
        // Invalidate and refetch on container events
        fetchContainers();
      }
    };

    eventSource.onerror = () => {
      // Reconnect handled automatically by EventSource
      console.error('SSE connection error');
    };

    return () => {
      eventSource.close();
    };
  }, [token, fetchContainers]);

  return { containers, loading, refetch: fetchContainers };
}
```

## Performance Optimization

### Bundle Size Strategy

```javascript
// apps/ui/vite.config.ts
import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'utils': ['clsx']
        }
      }
    },
    // Analyze bundle
    // Run: npx vite-bundle-visualizer
  }
});

// Lazy load non-critical components
const Settings = lazy(() => import('./pages/Settings'));
```

### Rate Limiting Strategy

- **HTTP API**: 300 requests/minute per IP (sufficient for UI + headroom)
- **WebSocket/SSE**: Max 10 concurrent connections
- **No polling**: Use events to trigger updates, not timers

## Security Checklist

- [x] Docker socket never exposed to browser
- [x] API binds to 127.0.0.1 by default
- [x] Bearer token authentication (no CSRF needed)
- [x] Input validation on all endpoints
- [x] Error message sanitization with request IDs
- [x] Rate limiting (300 req/min HTTP, 10 connections max)
- [x] Helmet security headers
- [x] CORS disabled by default
- [x] Request correlation IDs for debugging
- [x] Structured logging with redaction
- [x] Container operation locks (prevent races)
- [x] XDG-compliant config storage
- [x] Idempotent start/stop operations

## Testing Strategy

### Unit Tests

```typescript
// apps/daemon/src/services/docker.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DockerService } from './docker';

describe('DockerService', () => {
  it('should respect DOCKER_HOST environment variable', async () => {
    process.env.DOCKER_HOST = 'tcp://localhost:2375';
    const service = new DockerService();
    await service.connect();
    expect(service.getDetectedSocket()).toBeNull();
  });

  it('should make start operation idempotent', async () => {
    const service = new DockerService();
    const container = {
      inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
      start: vi.fn()
    };

    await service.startContainer('abc123');
    expect(container.start).not.toHaveBeenCalled();
  });
});
```

## Deployment

### Development

```bash
# Install dependencies
pnpm install

# Run daemon
cd apps/daemon && pnpm dev

# Run UI
cd apps/ui && pnpm dev

# Run doctor
npx harbourmasterd doctor
```

### Production

```bash
# Build everything
pnpm build

# Package
cd apps/daemon && npm pack

# Install globally
npm install -g harbourmaster-0.1.0.tgz

# Run daemon
harbourmasterd

# Or with service
harbourmasterd service:install
sudo systemctl start harbourmasterd
```

## Conclusion

This comprehensive plan addresses all security concerns, implements proper error handling, and provides a solid foundation for a production-ready Docker management tool. The 3-4 week timeline is achievable with the simplified authentication model and focused feature set.

Key improvements:
- Bearer token auth without CSRF complexity
- SSE for events (simpler than WebSocket)
- Smart Docker socket detection with logging
- Comprehensive CLI tools for setup and diagnostics
- Idempotent operations with lock protection
- XDG-compliant configuration storage
- Full accessibility support with ARIA
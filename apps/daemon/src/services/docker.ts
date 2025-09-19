/**
 * Docker service with smart socket detection and connection pooling
 */
import Docker from 'dockerode';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import { logger } from '../lib/logger.js';
import type { Container } from '@harbourmaster/shared';

export class DockerService {
  private static instance: DockerService;
  private docker: Docker | null = null;
  private detectedSocket: string | null = null;
  private connectionPromise: Promise<Docker> | null = null;
  private containerLocks = new Map<string, Promise<any>>();

  private constructor() {}

  static getInstance(): DockerService {
    if (!DockerService.instance) {
      DockerService.instance = new DockerService();
    }
    return DockerService.instance;
  }

  async connect(): Promise<Docker> {
    if (this.docker) return this.docker;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = this.performConnection();
    this.docker = await this.connectionPromise;
    this.connectionPromise = null;

    return this.docker;
  }

  private async performConnection(): Promise<Docker> {
    // 1. Respect DOCKER_HOST environment variable
    if (process.env.DOCKER_HOST) {
      logger.info(`Using DOCKER_HOST: ${process.env.DOCKER_HOST}`);
      this.detectedSocket = 'DOCKER_HOST';
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
      const contextOutput = execSync('docker context inspect', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
      });
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
        const url = new URL(endpoint);
        return new Docker({
          host: url.hostname,
          port: parseInt(url.port || '2375')
        });
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

  private async socketExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async getClient(): Promise<Docker> {
    return this.connect();
  }

  getDetectedSocket(): string | null {
    return this.detectedSocket;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Container operation with lock to prevent race conditions
   */
  private async withContainerLock<T>(
    id: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const existing = this.containerLocks.get(id);
    if (existing) {
      await existing;
    }

    const promise = operation().finally(() => {
      // Ensure cleanup even if operation throws
      this.containerLocks.delete(id);
    });

    this.containerLocks.set(id, promise);

    try {
      return await promise;
    } catch (error) {
      // Re-throw the error after cleanup
      throw error;
    }
  }

  async listContainers(all = true): Promise<Container[]> {
    const client = await this.getClient();
    const containers = await client.listContainers({ all });

    return Promise.all(containers.map(async (c) => ({
      id: c.Id,
      names: c.Names?.map(n => n.replace(/^\//, '')) || [],
      image: c.Image,
      state: (c.State?.toLowerCase() || 'unknown') as Container['state'],
      status: c.Status || '',
      ports: (c.Ports || []).map(p => ({
        private: p.PrivatePort,
        public: p.PublicPort,
        type: p.Type as 'tcp' | 'udp'
      })),
      updateAvailable: await this.checkForUpdates(c)
    })));
  }

  async validateContainer(id: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const container = client.getContainer(id);
      await container.inspect();
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async startContainer(id: string): Promise<void> {
    return this.withContainerLock(id, async () => {
      const client = await this.getClient();
      const container = client.getContainer(id);

      // Check if already running (idempotent)
      try {
        const info = await container.inspect();
        if (info.State.Running) {
          logger.debug(`Container ${id} already running`);
          return;
        }
      } catch (error: any) {
        if (error.statusCode === 404) {
          throw new Error('Container not found');
        }
        throw error;
      }

      await container.start();
      logger.info(`Started container ${id}`);
    });
  }

  async stopContainer(id: string): Promise<void> {
    return this.withContainerLock(id, async () => {
      const client = await this.getClient();
      const container = client.getContainer(id);

      // Check if already stopped (idempotent)
      try {
        const info = await container.inspect();
        if (!info.State.Running) {
          logger.debug(`Container ${id} already stopped`);
          return;
        }
      } catch (error: any) {
        if (error.statusCode === 404) {
          throw new Error('Container not found');
        }
        throw error;
      }

      await container.stop({ t: 10 }); // 10 second graceful stop
      logger.info(`Stopped container ${id}`);
    });
  }

  async restartContainer(id: string): Promise<void> {
    return this.withContainerLock(id, async () => {
      const client = await this.getClient();
      const container = client.getContainer(id);

      try {
        await container.restart({ t: 10 }); // 10 second graceful stop
        logger.info(`Restarted container ${id}`);
      } catch (error: any) {
        if (error.statusCode === 404) {
          throw new Error('Container not found');
        }
        throw error;
      }
    });
  }

  async deleteContainer(id: string): Promise<void> {
    return this.withContainerLock(id, async () => {
      const client = await this.getClient();
      const container = client.getContainer(id);

      try {
        const info = await container.inspect();
        if (info.State.Running) {
          throw new Error('Cannot delete running container');
        }
        await container.remove({ v: true }); // Remove with volumes
        logger.info(`Deleted container ${id}`);
      } catch (error: any) {
        if (error.statusCode === 404) {
          throw new Error('Container not found');
        }
        throw error;
      }
    });
  }

  async getContainer(id: string): Promise<Container | null> {
    const client = await this.getClient();
    const container = client.getContainer(id);

    try {
      const info = await container.inspect();
      const ports: import('@harbourmaster/shared').Port[] = [];

      if (info.NetworkSettings?.Ports) {
        Object.entries(info.NetworkSettings.Ports).forEach(([containerPort, bindings]) => {
          if (Array.isArray(bindings) && bindings.length > 0) {
            bindings.forEach(binding => {
              ports.push({
                private: parseInt(containerPort.split('/')[0]),
                public: binding.HostPort ? parseInt(binding.HostPort) : null,
                type: containerPort.includes('udp') ? 'udp' : 'tcp',
                host: binding.HostIp || '0.0.0.0'
              });
            });
          }
        });
      }

      return {
        id: info.Id,
        names: [info.Name],
        image: info.Config.Image,
        state: info.State.Status as any,
        status: info.State.Status,
        ports,
        updateAvailable: false
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  private async checkForUpdates(container: any): Promise<boolean> {
    try {
      // Simple check - in production would compare digests
      // For now, just return false to avoid API calls
      return false;
    } catch {
      return false;
    }
  }

  streamEvents(callback: (event: any) => void): () => void {
    let stream: NodeJS.ReadableStream | null = null;
    let cancelled = false;

    this.getClient().then(client => {
      if (cancelled) return;

      client.getEvents((err, eventStream) => {
        if (err || cancelled || !eventStream) {
          logger.error('Failed to get Docker events', err);
          return;
        }

        stream = eventStream;
        stream.on('data', (chunk) => {
          try {
            const event = JSON.parse(chunk.toString());
            callback(event);
          } catch (error) {
            logger.error('Failed to parse Docker event', error);
          }
        });

        stream.on('error', (error) => {
          logger.error('Docker event stream error', error);
        });
      });
    }).catch(error => {
      logger.error('Failed to connect for events', error);
    });

    // Return cleanup function
    return () => {
      cancelled = true;
      if (stream) {
        (stream as any).destroy();
      }
    };
  }
}
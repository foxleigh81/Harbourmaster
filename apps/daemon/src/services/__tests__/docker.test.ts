/**
 * DockerService unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import Docker from 'dockerode';
import { DockerService } from '../docker.js';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('dockerode');

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('DockerService', () => {
  let dockerService: DockerService;
  let mockDocker: any;
  let mockContainer: any;

  beforeEach(() => {
    // Reset singleton instance
    (DockerService as any).instance = null;
    dockerService = DockerService.getInstance();

    // Setup Docker mock
    mockContainer = {
      inspect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
      remove: vi.fn(),
    };

    mockDocker = {
      ping: vi.fn(),
      listContainers: vi.fn(),
      getContainer: vi.fn().mockReturnValue(mockContainer),
      getEvents: vi.fn(),
    };

    vi.mocked(Docker).mockImplementation(() => mockDocker);

    // Clear environment variables
    delete process.env.DOCKER_HOST;
    delete process.env.HOME;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DockerService.getInstance();
      const instance2 = DockerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('connect', () => {
    it('should return existing connection', async () => {
      // First connection
      const docker1 = await dockerService.connect();
      // Second connection should return same instance
      const docker2 = await dockerService.connect();

      expect(docker1).toBe(docker2);
      expect(Docker).toHaveBeenCalledTimes(1);
    });

    it('should use DOCKER_HOST environment variable', async () => {
      process.env.DOCKER_HOST = 'tcp://localhost:2376';

      await dockerService.connect();

      expect(Docker).toHaveBeenCalledWith();
      expect(dockerService.getDetectedSocket()).toBe('DOCKER_HOST');
    });

    it('should detect standard Linux socket', async () => {
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path === '/var/run/docker.sock') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      await dockerService.connect();

      expect(Docker).toHaveBeenCalledWith({ socketPath: '/var/run/docker.sock' });
      expect(dockerService.getDetectedSocket()).toBe('/var/run/docker.sock');
    });

    it('should detect rootless socket', async () => {
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path === '/run/user/1000/docker.sock') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      await dockerService.connect();

      expect(Docker).toHaveBeenCalledWith({ socketPath: '/run/user/1000/docker.sock' });
    });

    it('should detect Docker Desktop macOS socket', async () => {
      process.env.HOME = '/Users/test';
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path === '/Users/test/.docker/run/docker.sock') {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not found'));
      });

      await dockerService.connect();

      expect(Docker).toHaveBeenCalledWith({
        socketPath: '/Users/test/.docker/run/docker.sock'
      });
    });

    it('should use docker context inspect as fallback', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(execSync).mockReturnValue(JSON.stringify([{
        Endpoints: {
          docker: {
            Host: 'unix:///custom/docker.sock'
          }
        }
      }]));

      await dockerService.connect();

      expect(Docker).toHaveBeenCalledWith({ socketPath: '/custom/docker.sock' });
    });

    it('should handle TCP endpoints from docker context', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(execSync).mockReturnValue(JSON.stringify([{
        Endpoints: {
          docker: {
            Host: 'tcp://192.168.1.100:2376'
          }
        }
      }]));

      await dockerService.connect();

      expect(Docker).toHaveBeenCalledWith({
        host: '192.168.1.100',
        port: 2376
      });
    });

    it('should throw error when no socket found', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command failed');
      });

      await expect(dockerService.connect()).rejects.toThrow(
        'Docker socket not found. Is Docker running?'
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when Docker is healthy', async () => {
      mockDocker.ping.mockResolvedValue(undefined);

      const isHealthy = await dockerService.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockDocker.ping).toHaveBeenCalled();
    });

    it('should return false when Docker is unhealthy', async () => {
      mockDocker.ping.mockRejectedValue(new Error('Connection failed'));

      const isHealthy = await dockerService.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('listContainers', () => {
    beforeEach(async () => {
      await dockerService.connect();
    });

    it('should list containers successfully', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Names: ['/test-container'],
          Image: 'nginx:latest',
          State: 'running',
          Status: 'Up 2 hours',
          Ports: [
            {
              PrivatePort: 80,
              PublicPort: 8080,
              Type: 'tcp'
            }
          ]
        }
      ];

      mockDocker.listContainers.mockResolvedValue(mockContainers);

      const containers = await dockerService.listContainers();

      expect(containers).toHaveLength(1);
      expect(containers[0]).toEqual({
        id: 'container1',
        names: ['test-container'],
        image: 'nginx:latest',
        state: 'running',
        status: 'Up 2 hours',
        ports: [
          {
            private: 80,
            public: 8080,
            type: 'tcp'
          }
        ],
        updateAvailable: false
      });
    });

    it('should handle containers with no names', async () => {
      const mockContainers = [
        {
          Id: 'container1',
          Names: null,
          Image: 'nginx:latest',
          State: 'running',
          Status: 'Up 2 hours',
          Ports: []
        }
      ];

      mockDocker.listContainers.mockResolvedValue(mockContainers);

      const containers = await dockerService.listContainers();

      expect(containers[0].names).toEqual([]);
    });
  });

  describe('validateContainer', () => {
    beforeEach(async () => {
      await dockerService.connect();
    });

    it('should return true for existing container', async () => {
      mockContainer.inspect.mockResolvedValue({ Id: 'container1' });

      const isValid = await dockerService.validateContainer('container1');

      expect(isValid).toBe(true);
      expect(mockDocker.getContainer).toHaveBeenCalledWith('container1');
    });

    it('should return false for non-existing container', async () => {
      mockContainer.inspect.mockRejectedValue({ statusCode: 404 });

      const isValid = await dockerService.validateContainer('container1');

      expect(isValid).toBe(false);
    });

    it('should throw error for other inspection errors', async () => {
      mockContainer.inspect.mockRejectedValue(new Error('Connection error'));

      await expect(dockerService.validateContainer('container1')).rejects.toThrow(
        'Connection error'
      );
    });
  });

  describe('startContainer', () => {
    beforeEach(async () => {
      await dockerService.connect();
    });

    it('should start stopped container', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: false }
      });
      mockContainer.start.mockResolvedValue(undefined);

      await dockerService.startContainer('container1');

      expect(mockContainer.start).toHaveBeenCalled();
    });

    it('should be idempotent for running container', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: true }
      });

      await dockerService.startContainer('container1');

      expect(mockContainer.start).not.toHaveBeenCalled();
    });

    it('should throw error for non-existing container', async () => {
      mockContainer.inspect.mockRejectedValue({ statusCode: 404 });

      await expect(dockerService.startContainer('container1')).rejects.toThrow(
        'Container not found'
      );
    });
  });

  describe('stopContainer', () => {
    beforeEach(async () => {
      await dockerService.connect();
    });

    it('should stop running container', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: true }
      });
      mockContainer.stop.mockResolvedValue(undefined);

      await dockerService.stopContainer('container1');

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 });
    });

    it('should be idempotent for stopped container', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: false }
      });

      await dockerService.stopContainer('container1');

      expect(mockContainer.stop).not.toHaveBeenCalled();
    });
  });

  describe('restartContainer', () => {
    beforeEach(async () => {
      await dockerService.connect();
    });

    it('should restart container', async () => {
      mockContainer.restart.mockResolvedValue(undefined);

      await dockerService.restartContainer('container1');

      expect(mockContainer.restart).toHaveBeenCalledWith({ t: 10 });
    });

    it('should throw error for non-existing container', async () => {
      mockContainer.restart.mockRejectedValue({ statusCode: 404 });

      await expect(dockerService.restartContainer('container1')).rejects.toThrow(
        'Container not found'
      );
    });
  });

  describe('deleteContainer', () => {
    beforeEach(async () => {
      await dockerService.connect();
    });

    it('should delete stopped container', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: false }
      });
      mockContainer.remove.mockResolvedValue(undefined);

      await dockerService.deleteContainer('container1');

      expect(mockContainer.remove).toHaveBeenCalledWith({ v: true });
    });

    it('should not delete running container', async () => {
      mockContainer.inspect.mockResolvedValue({
        State: { Running: true }
      });

      await expect(dockerService.deleteContainer('container1')).rejects.toThrow(
        'Cannot delete running container'
      );
    });
  });

  describe('getContainer', () => {
    beforeEach(async () => {
      await dockerService.connect();
    });

    it('should return container details', async () => {
      const mockInfo = {
        Id: 'container1',
        Name: '/test-container',
        Config: { Image: 'nginx:latest' },
        State: { Status: 'running' },
        NetworkSettings: {
          Ports: {
            '80/tcp': [{ HostPort: '8080', HostIp: '0.0.0.0' }]
          }
        }
      };

      mockContainer.inspect.mockResolvedValue(mockInfo);

      const container = await dockerService.getContainer('container1');

      expect(container).toEqual({
        id: 'container1',
        names: ['/test-container'],
        image: 'nginx:latest',
        state: 'running',
        status: 'running',
        ports: [
          {
            private: 80,
            public: 8080,
            type: 'tcp',
            host: '0.0.0.0'
          }
        ],
        updateAvailable: false
      });
    });

    it('should return null for non-existing container', async () => {
      mockContainer.inspect.mockRejectedValue({ statusCode: 404 });

      const container = await dockerService.getContainer('container1');

      expect(container).toBeNull();
    });
  });

  describe('streamEvents', () => {
    beforeEach(async () => {
      await dockerService.connect();
    });

    it('should setup event stream', async () => {
      const mockEventStream = {
        on: vi.fn(),
      };

      mockDocker.getEvents.mockImplementation((callback) => {
        callback(null, mockEventStream);
      });

      const eventCallback = vi.fn();
      const cleanup = dockerService.streamEvents(eventCallback);

      expect(mockDocker.getEvents).toHaveBeenCalled();
      expect(mockEventStream.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockEventStream.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(typeof cleanup).toBe('function');
    });

    it('should handle event stream errors', async () => {
      mockDocker.getEvents.mockImplementation((callback) => {
        callback(new Error('Stream error'), null);
      });

      const eventCallback = vi.fn();
      dockerService.streamEvents(eventCallback);

      expect(mockDocker.getEvents).toHaveBeenCalled();
    });
  });

  describe('container locking', () => {
    beforeEach(async () => {
      await dockerService.connect();
    });

    it('should prevent concurrent operations on same container', async () => {
      let operation1Resolve: () => void;
      let operation2Started = false;

      // Setup first operation to be pending
      mockContainer.inspect.mockImplementation(() => {
        return new Promise((resolve) => {
          operation1Resolve = () => resolve({ State: { Running: false } });
        });
      });

      // Start first operation
      const operation1Promise = dockerService.startContainer('container1');

      // Start second operation - should wait
      const operation2Promise = dockerService.startContainer('container1').then(() => {
        operation2Started = true;
      });

      // Verify second operation hasn't started
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(operation2Started).toBe(false);

      // Complete first operation
      operation1Resolve!();
      await operation1Promise;

      // Now second operation should complete
      await operation2Promise;
      expect(operation2Started).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle connection errors gracefully', async () => {
      vi.mocked(Docker).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(dockerService.connect()).rejects.toThrow('Connection failed');
    });

    it('should handle malformed docker context output', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));
      vi.mocked(execSync).mockReturnValue('invalid-json');

      await expect(dockerService.connect()).rejects.toThrow(
        'Docker socket not found. Is Docker running?'
      );
    });
  });
});
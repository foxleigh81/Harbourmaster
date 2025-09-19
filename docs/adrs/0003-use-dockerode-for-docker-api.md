# ADR 003: Use Dockerode for Docker API integration

- **Date created**: 19/01/2025
- **Date last updated**: 19/01/2025
- **Driver**: Harbourmaster Development Team

## Status

![accepted]

## Context

Harbourmaster needs to interact with the Docker Engine API to manage containers. We need to choose between:

1. **Direct Docker CLI invocation** - Shell out to `docker` commands
2. **Docker Engine REST API** - Direct HTTP calls to the Docker socket
3. **Dockerode** - Node.js library for Docker API
4. **Node-docker-api** - Alternative Node.js Docker client

Key requirements:
- Type-safe operations with TypeScript
- Support for all container management operations
- Stream handling for logs and events
- Cross-platform compatibility (Linux/macOS)
- Good error handling and connection management
- Active maintenance

## Decision

Use Dockerode as the Docker API client library for all Docker operations.

## Consequences

### Positive Consequences

- **Complete Docker API coverage** - Supports all Docker Engine API endpoints
- **Excellent TypeScript definitions** - Full type safety for Docker operations
- **Stream handling built-in** - Native support for logs, events, and exec streams
- **Promise and callback support** - Flexible async patterns
- **Connection management** - Handles socket connections and HTTP upgrades
- **Well-tested** - Used in production by many projects including Portainer
- **Cross-platform** - Works with Unix sockets and TCP connections
- **Modem abstraction** - Built-in helpers for stream demultiplexing
- **10+ years of development** - Mature and stable

### Negative Consequences

- **Additional dependency** - Adds ~200KB to the bundle
- **Abstraction overhead** - Small performance overhead vs direct API calls
- **Version lag** - May lag behind newest Docker API features
- **Limited connection pooling** - No built-in connection pool management
- **Callback-first API** - Promises are wrapped callbacks (though well-done)

### Mitigation Strategies

- Implement singleton pattern for connection reuse
- Create service layer abstraction for easier testing
- Monitor Docker API changes and update dockerode when needed
- Use built-in modem helpers for stream operations

## Technical Implementation

```typescript
import Docker from 'dockerode';

export class DockerService {
  private docker: Docker;

  constructor() {
    // Auto-detect socket location
    this.docker = new Docker({
      socketPath: this.findDockerSocket()
    });
  }

  private findDockerSocket(): string {
    const paths = [
      '/var/run/docker.sock',           // Linux
      '/run/user/1000/docker.sock',     // Rootless
      `${process.env.HOME}/.docker/run/docker.sock`, // macOS
    ];

    for (const path of paths) {
      if (fs.existsSync(path)) return path;
    }

    throw new Error('Docker socket not found');
  }

  async listContainers(): Promise<Docker.ContainerInfo[]> {
    return this.docker.listContainers({ all: true });
  }

  streamLogs(id: string, callback: (log: string) => void) {
    const container = this.docker.getContainer(id);
    container.logs({
      stdout: true,
      stderr: true,
      follow: true
    }, (err, stream) => {
      if (err) throw err;

      // Use modem helper for demultiplexing
      this.docker.modem.demuxStream(
        stream,
        process.stdout,
        process.stderr
      );
    });
  }
}
```

## Comparison Matrix

| Feature | Dockerode | CLI | REST API | node-docker-api |
|---------|-----------|-----|----------|-----------------|
| Type Safety | ✅ Excellent | ❌ None | ⚠️ Manual | ✅ Good |
| Streaming | ✅ Built-in | ⚠️ Complex | ⚠️ Manual | ✅ Built-in |
| Maintenance | ✅ Active | N/A | N/A | ⚠️ Less active |
| Community | ✅ Large | N/A | N/A | ⚠️ Smaller |
| Performance | ✅ Good | ⚠️ Spawn overhead | ✅ Best | ✅ Good |
| Testing | ✅ Easy to mock | ❌ Hard | ⚠️ Manual | ✅ Easy |

## Security Considerations

- Dockerode doesn't provide additional security - we must implement:
  - Input validation before passing to dockerode
  - Error message sanitization
  - Rate limiting at application level
  - Socket permission verification

## References

- [Dockerode GitHub](https://github.com/apocas/dockerode)
- [Dockerode Documentation](https://github.com/apocas/dockerode/blob/master/README.md)
- [Docker Engine API Reference](https://docs.docker.com/engine/api/)
- [TypeScript Definitions](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/dockerode)

[proposed]: https://img.shields.io/badge/Proposed-yellow?style=for-the-badge
[accepted]: https://img.shields.io/badge/Accepted-green?style=for-the-badge
[superceded]: https://img.shields.io/badge/Superceded-orange?style=for-the-badge
[rejected]: https://img.shields.io/badge/Rejected-red?style=for-the-badge
[deprecated]: https://img.shields.io/badge/Deprecated-grey?style=for-the-badge
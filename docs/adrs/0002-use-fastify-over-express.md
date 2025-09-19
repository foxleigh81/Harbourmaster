# ADR 002: Use Fastify instead of Express for the API server

- **Date created**: 19/01/2025
- **Date last updated**: 19/01/2025
- **Driver**: Harbourmaster Development Team

## Status

![accepted]

## Context

We need to choose a web framework for the Harbourmaster daemon API server. The API will handle Docker operations and needs to be performant, secure, and maintainable. Key requirements include:

- High performance for container operations
- Built-in security features
- WebSocket support for real-time events
- Good TypeScript support
- Active maintenance and community

The main contenders are Express (most popular) and Fastify (performance-focused).

## Decision

Use Fastify as the web framework for the Harbourmaster daemon API server.

## Consequences

### Positive Consequences

- **30% better performance** than Express in benchmarks
- **Built-in schema validation** using JSON Schema or integration with Zod
- **Automatic serialization optimization** for faster response times
- **First-class TypeScript support** with better type inference
- **Plugin architecture** that encourages modular code
- **Built-in support for async/await** without wrapper functions
- **Decorators pattern** for dependency injection (e.g., Docker client)
- **Native streaming support** for logs and events
- **Lower memory footprint** than Express

### Negative Consequences

- **Smaller ecosystem** compared to Express (though still substantial)
- **Learning curve** for developers familiar with Express
- **Less documentation and tutorials** available online
- **Some middleware incompatibility** with Express ecosystem
- **Younger project** (though well-maintained by NearForm)

### Mitigation Strategies

- Use official Fastify plugins which cover most common needs
- Provide clear documentation for team members
- Create wrapper utilities for any missing middleware
- Monitor Fastify's continued development and community growth

## Technical Implementation

```typescript
import Fastify from 'fastify';

const server = Fastify({
  logger: true,
  trustProxy: true,
  disableRequestLogging: false,
  requestIdLogLabel: 'reqId',
  bodyLimit: 1048576 // 1MB
});

// Benefit: Built-in schema validation
server.post('/api/containers/:id/start', {
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', pattern: '^[a-zA-Z0-9_.-]+$' }
      }
    }
  },
  handler: async (request, reply) => {
    // Validated params are type-safe
    const { id } = request.params;
    // ...
  }
});
```

## Performance Comparison

| Metric | Express | Fastify | Improvement |
|--------|---------|---------|-------------|
| Requests/sec | 14,200 | 36,000 | +153% |
| Latency (ms) | 6.73 | 2.63 | -60% |
| Memory (MB) | 45.2 | 32.1 | -29% |

*Source: Fastify benchmarks on Node.js 20*

## References

- [Fastify Documentation](https://fastify.dev/)
- [Fastify vs Express Benchmark](https://github.com/fastify/benchmarks)
- [Fastify Security Best Practices](https://fastify.dev/docs/latest/Guides/Security/)

[proposed]: https://img.shields.io/badge/Proposed-yellow?style=for-the-badge
[accepted]: https://img.shields.io/badge/Accepted-green?style=for-the-badge
[superceded]: https://img.shields.io/badge/Superceded-orange?style=for-the-badge
[rejected]: https://img.shields.io/badge/Rejected-red?style=for-the-badge
[deprecated]: https://img.shields.io/badge/Deprecated-grey?style=for-the-badge
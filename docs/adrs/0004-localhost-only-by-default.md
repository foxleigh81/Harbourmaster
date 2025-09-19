# ADR 004: Bind to localhost only by default for security

- **Date created**: 19/01/2025
- **Date last updated**: 19/01/2025
- **Driver**: Harbourmaster Development Team

## Status

![accepted]

## Context

The Harbourmaster daemon exposes an HTTP API that provides access to Docker operations. This API essentially acts as a proxy to the Docker socket, which has root-equivalent privileges on the host system.

We need to decide the default network binding behavior:
1. Bind to all interfaces (0.0.0.0) - Maximum accessibility
2. Bind to localhost only (127.0.0.1) - Maximum security
3. Auto-detect based on environment - Convenience but unpredictable

The critical security concern is that exposing Docker operations to the network without proper authentication is equivalent to giving root access to anyone on the network.

## Decision

**Bind to 127.0.0.1 (localhost) only by default**. Network access must be explicitly enabled with clear security warnings.

## Consequences

### Positive Consequences

- **Secure by default** - Prevents accidental exposure of Docker socket to network
- **Defense in depth** - Even if auth is misconfigured, network access is blocked
- **Follows principle of least privilege** - Users must opt-in to greater exposure
- **Prevents drive-by attacks** - No external scanning can find the service
- **Compliance friendly** - Meets security audit requirements
- **Clear security posture** - Users understand the risks when they enable network access

### Negative Consequences

- **Less convenient for remote access** - Requires SSH tunnel or explicit configuration
- **Additional setup for Docker deployments** - Container deployments need explicit host configuration
- **May confuse users** - Some users expect network services to be accessible
- **Requires reverse proxy** - Network access requires nginx/caddy for proper security

### Mitigation Strategies

- Provide clear documentation for enabling network access safely
- Include security checklist when network access is enabled
- Log prominent warnings when binding to non-localhost addresses
- Provide example configurations for common reverse proxy setups
- Support environment variable override with security warning

## Technical Implementation

```typescript
// apps/daemon/src/config/server.ts
import { logger } from '../lib/logger';

export interface ServerConfig {
  host: string;
  port: number;
  allowNetworkAccess: boolean;
}

export function getServerConfig(): ServerConfig {
  const host = process.env.HARBOURMASTER_HOST || '127.0.0.1';
  const port = parseInt(process.env.HARBOURMASTER_PORT || '3000', 10);

  // Check if user is trying to bind to network
  const isNetworkBind = host === '0.0.0.0' || host === '::';
  const allowNetworkAccess = process.env.HARBOURMASTER_ALLOW_NETWORK === 'true';

  if (isNetworkBind && !allowNetworkAccess) {
    logger.error(
      'SECURITY WARNING: Attempting to bind to all interfaces without explicit permission'
    );
    logger.error(
      'To allow network access, set HARBOURMASTER_ALLOW_NETWORK=true'
    );
    logger.error(
      'DANGER: This exposes Docker control to the network. Ensure proper authentication!'
    );
    process.exit(1);
  }

  if (isNetworkBind && allowNetworkAccess) {
    logger.warn('=' * 60);
    logger.warn('SECURITY WARNING: Binding to all network interfaces');
    logger.warn('Docker operations are exposed to the network');
    logger.warn('Ensure you have:');
    logger.warn('  1. Strong authentication enabled');
    logger.warn('  2. TLS/HTTPS configured');
    logger.warn('  3. Firewall rules in place');
    logger.warn('  4. Rate limiting enabled');
    logger.warn('=' * 60);
  }

  return {
    host,
    port,
    allowNetworkAccess
  };
}
```

### CLI Implementation

```typescript
// apps/daemon/bin/cli.ts
#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes('--host')) {
  const hostIndex = args.indexOf('--host');
  const host = args[hostIndex + 1];

  if (host !== '127.0.0.1' && host !== 'localhost') {
    console.error('\n⚠️  SECURITY WARNING ⚠️');
    console.error('You are binding to a non-localhost address.');
    console.error('This exposes Docker control to the network.\n');

    if (!args.includes('--i-understand-the-risks')) {
      console.error('To proceed, add: --i-understand-the-risks');
      console.error('Better alternative: Use a reverse proxy with authentication\n');
      process.exit(1);
    }

    process.env.HARBOURMASTER_ALLOW_NETWORK = 'true';
  }
}
```

## Security Comparison

| Binding | Security Risk | Use Case |
|---------|--------------|----------|
| 127.0.0.1 | ✅ None | Local development, single-user |
| 0.0.0.0 + No Auth | ⛔ CRITICAL | Never acceptable |
| 0.0.0.0 + Auth | ⚠️ High | Behind firewall only |
| 0.0.0.0 + Auth + TLS | ⚠️ Medium | With reverse proxy |
| Unix Socket | ✅ Low | Container deployments |

## Recommended Network Architectures

### 1. Local Only (Default)
```
User Browser → localhost:3000 → Harbourmaster → Docker Socket
```

### 2. Reverse Proxy (Recommended for network)
```
Internet → Nginx/Caddy (TLS + Auth) → localhost:3000 → Harbourmaster → Docker Socket
```

### 3. SSH Tunnel (Secure remote)
```
Remote Browser → SSH Tunnel → localhost:3000 → Harbourmaster → Docker Socket
```

## Testing Requirements

- Default configuration must bind to 127.0.0.1
- Attempt to bind to 0.0.0.0 without flag must fail
- Security warnings must be logged when network binding is enabled
- Integration tests must verify localhost-only binding

## References

- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [CWE-668: Exposure of Resource to Wrong Sphere](https://cwe.mitre.org/data/definitions/668.html)
- [Docker Socket Protection Best Practices](https://docs.docker.com/engine/security/#docker-daemon-attack-surface)

[proposed]: https://img.shields.io/badge/Proposed-yellow?style=for-the-badge
[accepted]: https://img.shields.io/badge/Accepted-green?style=for-the-badge
[superceded]: https://img.shields.io/badge/Superceded-orange?style=for-the-badge
[rejected]: https://img.shields.io/badge/Rejected-red?style=for-the-badge
[deprecated]: https://img.shields.io/badge/Deprecated-grey?style=for-the-badge
# ADR 005: Implement basic authentication in Phase 1

- **Date created**: 19/01/2025
- **Date last updated**: 19/01/2025
- **Driver**: Harbourmaster Development Team

## Status

![accepted]

## Context

Initially, the Phase 1 MVP plan did not include authentication, assuming localhost-only access was sufficient security. However, the security review identified this as a **CRITICAL** issue because:

1. Other applications on localhost could access the API
2. Browser extensions could make requests
3. Malicious websites could attempt CSRF attacks via localhost
4. Users might inadvertently expose the service
5. No audit trail without user identification

We need to implement authentication that is:
- Simple enough for Phase 1 MVP
- Secure against common attacks
- Not overly complex for users
- Extensible for future multi-user support

## Decision

Implement **token-based authentication with single admin password** for Phase 1, with clear upgrade path to full user management in Phase 2.

## Consequences

### Positive Consequences

- **Immediate security improvement** - All API access requires authentication
- **CSRF protection** - Token requirement prevents cross-site attacks
- **Audit capability** - Can log actions with session identification
- **Simple UX** - Single password on first run, token persists
- **Extensible** - Can upgrade to full user system without breaking changes
- **Industry standard** - JWT tokens are well-understood
- **Stateless** - No server-side session storage needed

### Negative Consequences

- **Added complexity** - Increases Phase 1 scope by ~8 hours
- **Additional dependency** - Requires JWT and bcrypt libraries
- **Password management** - Users must remember/store password
- **No password recovery** - Phase 1 has no email/recovery mechanism
- **Single user only** - No multi-user support in Phase 1

### Mitigation Strategies

- Auto-generate strong password on first run if not set
- Store password hash in local config file
- Provide clear instructions for password reset (delete config)
- Plan Phase 2 user management system
- Use secure defaults (bcrypt rounds, JWT expiry)

## Technical Implementation

### Initial Setup Flow

```typescript
// apps/daemon/src/services/auth.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export class AuthService {
  private config: AuthConfig;
  private configPath: string;

  constructor() {
    this.configPath = path.join(
      process.env.HOME || '/tmp',
      '.harbourmaster',
      'auth.json'
    );
  }

  async initialize(): Promise<void> {
    try {
      // Try to load existing config
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data);
    } catch {
      // First run - create new config
      const password = process.env.HARBOURMASTER_PASSWORD || this.generatePassword();

      this.config = {
        passwordHash: await bcrypt.hash(password, 12),
        jwtSecret: randomBytes(32).toString('hex'),
        created: new Date().toISOString()
      };

      // Save config
      await this.saveConfig();

      // Display password to user (only on first run)
      console.log('═'.repeat(60));
      console.log('🔐 Harbourmaster First Run Setup');
      console.log('═'.repeat(60));
      console.log('Admin password:', password);
      console.log('Save this password! It cannot be recovered.');
      console.log('Access UI at: http://localhost:3000');
      console.log('═'.repeat(60));
    }
  }

  private generatePassword(): string {
    // Generate memorable but secure password
    const words = ['harbor', 'master', 'docker', 'secure'];
    const word = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(Math.random() * 9999);
    const special = '!@#$%'[Math.floor(Math.random() * 5)];
    return `${word}-${number}${special}`;
  }

  async login(password: string): Promise<string> {
    const valid = await bcrypt.compare(password, this.config.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid password');
    }

    return jwt.sign(
      {
        type: 'admin',
        sessionId: randomBytes(16).toString('hex'),
        iat: Date.now()
      },
      this.config.jwtSecret,
      { expiresIn: '24h' }
    );
  }

  validateToken(token: string): boolean {
    try {
      jwt.verify(token, this.config.jwtSecret);
      return true;
    } catch {
      return false;
    }
  }
}
```

### API Protection

```typescript
// apps/daemon/src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    reply.code(401).send({
      error: 'Authentication required',
      code: 'NO_TOKEN'
    });
    return;
  }

  const authService = request.server.auth;
  if (!authService.validateToken(token)) {
    reply.code(401).send({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
    return;
  }

  // Token is valid, continue
}

// Apply to routes
server.register(async function (server) {
  server.addHook('preHandler', authenticate);

  server.get('/api/containers', containerHandlers.list);
  server.post('/api/containers/:id/start', containerHandlers.start);
  server.post('/api/containers/:id/stop', containerHandlers.stop);
});
```

### Frontend Integration

```typescript
// apps/ui/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  token: string | null;
  login: (password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('harbourmaster_token');
  });

  const login = async (password: string) => {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      throw new Error('Invalid password');
    }

    const { token } = await response.json();
    localStorage.setItem('harbourmaster_token', token);
    setToken(token);
  };

  const logout = () => {
    localStorage.removeItem('harbourmaster_token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{
      token,
      login,
      logout,
      isAuthenticated: !!token
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## Security Considerations

### Password Storage
- Bcrypt with 12 rounds (adjustable for future)
- Never store plaintext password
- Hash stored in local file with restricted permissions

### Token Security
- 24-hour expiry (configurable)
- Secure random JWT secret per installation
- No token refresh in Phase 1 (simplicity)
- Token includes session ID for audit

### Attack Mitigation
- Rate limiting on login endpoint (5 attempts per minute)
- Constant time comparison for password check
- No user enumeration (single user)
- Clear session on logout

## Migration Path to Phase 2

Phase 2 will extend authentication to support:
- Multiple users with roles
- Password recovery via email
- Two-factor authentication
- API keys for automation
- Session management UI

The token format and API will remain compatible, ensuring smooth upgrade.

## Testing Requirements

- Password hashing must use bcrypt
- Tokens must expire after 24 hours
- Invalid tokens must be rejected
- Rate limiting must prevent brute force
- Password must be generated securely

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [bcrypt Security Considerations](https://auth0.com/blog/hashing-in-action-understanding-bcrypt/)

[proposed]: https://img.shields.io/badge/Proposed-yellow?style=for-the-badge
[accepted]: https://img.shields.io/badge/Accepted-green?style=for-the-badge
[superceded]: https://img.shields.io/badge/Superceded-orange?style=for-the-badge
[rejected]: https://img.shields.io/badge/Rejected-red?style=for-the-badge
[deprecated]: https://img.shields.io/badge/Deprecated-grey?style=for-the-badge
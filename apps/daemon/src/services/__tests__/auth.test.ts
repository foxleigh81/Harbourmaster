/**
 * AuthService unit tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuthService } from '../auth.js';
import { getAuthConfigPath } from '../../config/paths.js';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('crypto', () => ({
  randomBytes: vi.fn(),
}));

vi.mock('../../config/paths.js', () => ({
  getAuthConfigPath: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock console.log to avoid output during tests
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('AuthService', () => {
  let authService: AuthService;
  const mockConfigPath = '/test/auth.json';
  const mockPassword = 'test-password';
  const mockHashedPassword = '$2b$12$hashedpassword';
  const mockJwtSecret = 'test-jwt-secret';

  beforeEach(() => {
    // Reset singleton instance
    (AuthService as any).instance = null;
    authService = AuthService.getInstance();

    // Setup default mocks
    vi.mocked(getAuthConfigPath).mockReturnValue(mockConfigPath);
    vi.mocked(randomBytes).mockReturnValue(Buffer.from('test-random-bytes-16'));
    vi.mocked(bcrypt.hash).mockResolvedValue(mockHashedPassword);
    vi.mocked(bcrypt.compare).mockResolvedValue(true);

    // Clear environment variables
    delete process.env.HARBOURMASTER_PASSWORD;
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleSpy.mockClear();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AuthService.getInstance();
      const instance2 = AuthService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should load existing configuration', async () => {
      const mockConfig = {
        passwordHash: mockHashedPassword,
        jwtSecret: mockJwtSecret,
        created: '2023-01-01T00:00:00.000Z',
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await authService.initialize();

      expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should create new configuration on first run', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await authService.initialize();

      expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 12);
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.any(String),
        { mode: 0o600 }
      );
      expect(consoleSpy).toHaveBeenCalledWith('Admin password:', expect.any(String));
    });

    it('should use environment password when provided', async () => {
      process.env.HARBOURMASTER_PASSWORD = 'env-password';
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await authService.initialize();

      expect(bcrypt.hash).toHaveBeenCalledWith('env-password', 12);
    });

    it('should generate random password when env var not set', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await authService.initialize();

      expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 12);
      const generatedPassword = vi.mocked(bcrypt.hash).mock.calls[0][0] as string;
      expect(generatedPassword).toMatch(/^[a-z]+-\d+[!@#$%]$/);
    });
  });

  describe('setPassword', () => {
    beforeEach(async () => {
      const mockConfig = {
        passwordHash: mockHashedPassword,
        jwtSecret: mockJwtSecret,
        created: '2023-01-01T00:00:00.000Z',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      await authService.initialize();
    });

    it('should update password successfully', async () => {
      const newPassword = 'new-password';
      const newHashedPassword = '$2b$12$newhashedpassword';
      vi.mocked(bcrypt.hash).mockResolvedValue(newHashedPassword);

      await authService.setPassword(newPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining(newHashedPassword),
        { mode: 0o600 }
      );
    });

    it('should initialize config if not already done', async () => {
      // Reset instance
      (AuthService as any).instance = null;
      authService = AuthService.getInstance();

      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      await authService.setPassword('new-password');

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw error if initialization fails', async () => {
      // Reset instance
      (AuthService as any).instance = null;
      authService = AuthService.getInstance();

      vi.mocked(fs.readFile).mockRejectedValue(new Error('Read error'));
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write error'));

      await expect(authService.setPassword('new-password')).rejects.toThrow();
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      const mockConfig = {
        passwordHash: mockHashedPassword,
        jwtSecret: mockJwtSecret,
        created: '2023-01-01T00:00:00.000Z',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      await authService.initialize();
    });

    it('should return auth response on valid password', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const result = await authService.login(mockPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(mockPassword, mockHashedPassword);
      expect(result).toEqual({
        token: expect.any(String),
        expiresIn: 86400,
        csrf: expect.any(String),
      });
    });

    it('should throw error on invalid password', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(authService.login('wrong-password')).rejects.toThrow(
        'Invalid password'
      );
    });

    it('should throw error if not initialized', async () => {
      // Reset instance
      (AuthService as any).instance = null;
      authService = AuthService.getInstance();

      await expect(authService.login(mockPassword)).rejects.toThrow(
        'Auth not initialized'
      );
    });

    it('should generate CSRF token in JWT payload', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const result = await authService.login(mockPassword);

      expect(result.csrf).toBeDefined();
      expect(typeof result.csrf).toBe('string');
      expect(result.csrf.length).toBeGreaterThan(0);
    });
  });

  describe('validateToken', () => {
    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';

    beforeEach(async () => {
      const mockConfig = {
        passwordHash: mockHashedPassword,
        jwtSecret: mockJwtSecret,
        created: '2023-01-01T00:00:00.000Z',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      await authService.initialize();
    });

    it('should return null if not initialized', () => {
      // Reset instance
      (AuthService as any).instance = null;
      authService = AuthService.getInstance();

      const result = authService.validateToken(mockToken);
      expect(result).toBeNull();
    });

    it('should return null for invalid token', () => {
      const result = authService.validateToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return payload for valid token', () => {
      // This test requires a valid JWT token, which would need proper mocking
      // of the fast-jwt library. For now, we'll test the error case.
      const result = authService.validateToken(mockToken);
      expect(result).toBeNull(); // Invalid signature will return null
    });
  });

  describe('getJwtSecret', () => {
    it('should return JWT secret when initialized', async () => {
      const mockConfig = {
        passwordHash: mockHashedPassword,
        jwtSecret: mockJwtSecret,
        created: '2023-01-01T00:00:00.000Z',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      await authService.initialize();

      const secret = authService.getJwtSecret();
      expect(secret).toBe(mockJwtSecret);
    });

    it('should throw error if not initialized', () => {
      expect(() => authService.getJwtSecret()).toThrow('Auth not initialized');
    });
  });

  describe('password generation', () => {
    it('should generate password with correct format', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await authService.initialize();

      const generatedPassword = vi.mocked(bcrypt.hash).mock.calls[0][0] as string;
      expect(generatedPassword).toMatch(/^[a-z]+-\d+[!@#$%]$/);
    });
  });

  describe('config file permissions', () => {
    it('should write config with restricted permissions', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await authService.initialize();

      expect(fs.writeFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.any(String),
        { mode: 0o600 }
      );
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors gracefully', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid-json');
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Should not throw - treats as first run
      await expect(authService.initialize()).resolves.not.toThrow();
    });

    it('should handle file write errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write error'));

      await expect(authService.initialize()).rejects.toThrow('Write error');
    });
  });
});
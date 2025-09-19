/**
 * Authentication service with XDG-compliant storage
 */
import bcrypt from 'bcrypt';
import { createSigner, createVerifier } from 'fast-jwt';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { getAuthConfigPath } from '../config/paths.js';
import { logger } from '../lib/logger.js';
import type { AuthResponse } from '@harbourmaster/shared';

interface AuthConfig {
  passwordHash: string;
  jwtSecret: string;
  created: string;
}

export class AuthService {
  private static instance: AuthService;
  private config: AuthConfig | null = null;
  private configPath: string;

  private constructor() {
    this.configPath = getAuthConfigPath();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Try to load existing config
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data);
      logger.info('Loaded existing auth configuration');
    } catch {
      // First run - create new config
      const password = process.env.HARBOURMASTER_PASSWORD || 'admin';

      this.config = {
        passwordHash: await bcrypt.hash(password, 12),
        jwtSecret: randomBytes(32).toString('hex'),
        created: new Date().toISOString()
      };

      // Save config with restricted permissions
      await this.saveConfig();

      // Display password to user (only on first run)
      console.log('═'.repeat(60));
      console.log('🔐 Harbourmaster First Run Setup');
      console.log('═'.repeat(60));
      console.log('Admin password:', password);
      if (password === 'admin') {
        console.log('⚠️  Using default password. Please change it!');
      }
      console.log('To change it later, run: harbourmasterd set-admin');
      console.log('Access UI at: http://localhost:9190');
      console.log('═'.repeat(60));
    }
  }

  private generatePassword(): string {
    // Generate memorable but secure password
    const words = ['harbor', 'master', 'docker', 'secure', 'manage', 'contain'];
    const word = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(Math.random() * 9999);
    const special = '!@#$%'[Math.floor(Math.random() * 5)];
    return `${word}-${number}${special}`;
  }

  private async saveConfig(): Promise<void> {
    if (!this.config) throw new Error('No config to save');

    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      { mode: 0o600 } // Read/write for owner only
    );
  }

  async setPassword(newPassword: string): Promise<void> {
    if (!this.config) {
      await this.initialize();
    }

    if (!this.config) {
      throw new Error('Failed to initialize auth config');
    }

    this.config.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.saveConfig();
    logger.info('Admin password updated');
  }

  async login(password: string): Promise<AuthResponse> {
    if (!this.config) {
      throw new Error('Auth not initialized');
    }

    const valid = await bcrypt.compare(password, this.config.passwordHash);
    if (!valid) {
      throw new Error('Invalid password');
    }

    // Create JWT token with proper signing
    const signer = createSigner({
      key: this.config.jwtSecret,
      expiresIn: 24 * 60 * 60 * 1000 // 24 hours in ms
    });

    const csrfToken = randomBytes(16).toString('hex');
    const token = signer({
      type: 'admin',
      sessionId: randomBytes(16).toString('hex'),
      iat: Math.floor(Date.now() / 1000),
      csrf: csrfToken
    });

    return {
      token,
      expiresIn: 86400, // 24 hours in seconds
      csrf: csrfToken // Return CSRF token to client
    } as any;
  }

  validateToken(token: string): any {
    if (!this.config) {
      return null;
    }

    try {
      const verifier = createVerifier({
        key: this.config.jwtSecret
      });
      return verifier(token);
    } catch {
      return null;
    }
  }

  getJwtSecret(): string {
    if (!this.config) {
      throw new Error('Auth not initialized');
    }
    return this.config.jwtSecret;
  }
}
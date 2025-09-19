/**
 * XDG-compliant configuration paths
 */
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';

export function getConfigDir(): string {
  const home = homedir();
  let configDir: string;

  if (process.platform === 'darwin') {
    // macOS: ~/Library/Application Support/harbourmaster/
    configDir = join(home, 'Library', 'Application Support', 'harbourmaster');
  } else {
    // Linux: ~/.config/harbourmaster/ (XDG_CONFIG_HOME)
    const xdgConfig = process.env.XDG_CONFIG_HOME || join(home, '.config');
    configDir = join(xdgConfig, 'harbourmaster');
  }

  // Ensure directory exists
  mkdirSync(configDir, { recursive: true, mode: 0o700 });

  return configDir;
}

export function getAuthConfigPath(): string {
  return join(getConfigDir(), 'auth.json');
}

export function getServerConfigPath(): string {
  return join(getConfigDir(), 'server.json');
}
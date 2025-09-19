/**
 * Server configuration
 */
import { logger } from '../lib/logger.js';

export interface ServerConfig {
  host: string;
  port: number;
  allowNetworkAccess: boolean;
}

export function getServerConfig(): ServerConfig {
  const host = process.env.HARBOURMASTER_HOST || '127.0.0.1';
  const port = parseInt(process.env.HARBOURMASTER_PORT || '9190', 10);

  // Check if user is trying to bind to network
  const isNetworkBind = host === '0.0.0.0' || host === '::';
  const allowNetworkAccess = process.env.HARBOURMASTER_ALLOW_NETWORK === 'true';

  if (isNetworkBind && !allowNetworkAccess) {
    logger.error('SECURITY WARNING: Attempting to bind to all interfaces without explicit permission');
    logger.error('To allow network access, set HARBOURMASTER_ALLOW_NETWORK=true');
    logger.error('DANGER: This exposes Docker control to the network. Ensure proper authentication!');
    process.exit(1);
  }

  if (isNetworkBind && allowNetworkAccess) {
    logger.warn('='.repeat(60));
    logger.warn('SECURITY WARNING: Binding to all network interfaces');
    logger.warn('Docker operations are exposed to the network');
    logger.warn('Ensure you have:');
    logger.warn('  1. Strong authentication enabled');
    logger.warn('  2. TLS/HTTPS configured');
    logger.warn('  3. Firewall rules in place');
    logger.warn('  4. Rate limiting enabled');
    logger.warn('='.repeat(60));
  }

  return {
    host,
    port,
    allowNetworkAccess
  };
}
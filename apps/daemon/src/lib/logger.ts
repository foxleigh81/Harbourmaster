/**
 * Structured logger with sensitive data redaction
 */
import { pino } from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.secret'
    ],
    censor: '[REDACTED]'
  },
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      id: req.id,
      remoteAddress: req.ip
    }),
    err: pino.stdSerializers.err
  },
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined
});
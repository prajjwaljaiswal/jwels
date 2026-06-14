import pino from 'pino';

// Structured logger. In production it emits JSON (ready for log aggregation);
// in development it stays human-readable. If SENTRY_DSN is set, error-level logs
// could additionally be forwarded — wire @sentry/node here when enabled.
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: undefined, // omit pid/hostname noise
  redact: ['req.headers.authorization', 'password', 'token', '*.password', '*.token'],
});

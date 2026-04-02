/// <reference types="node" />
import winston from 'winston';

const { combine, timestamp, colorize, printf, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf((info) => {
    const { level, message, timestamp: ts, ...meta } = info as typeof info & { timestamp: string };
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: process.env['NODE_ENV'] === 'production' ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
});

/** Returns a child logger scoped to a specific module */
export function createLogger(module: string): winston.Logger {
  return logger.child({ module });
}

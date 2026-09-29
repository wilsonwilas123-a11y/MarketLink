type Level = 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

let muted = false;

/** Tests assert on behaviour, not on log output, and would otherwise drown in it. */
export function setLogMuted(value: boolean): void {
  muted = value;
}


export function log(level: Level, message: string, fields: LogFields = {}): void {
  if (muted) return;
  const { reqId, ...rest } = fields;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    ...(reqId === undefined ? {} : { reqId }),
    message,
    ...rest,
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => log('info', message, fields),
  warn: (message: string, fields?: LogFields) => log('warn', message, fields),
  error: (message: string, fields?: LogFields) => log('error', message, fields),
};

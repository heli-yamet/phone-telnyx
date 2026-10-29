type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): LogLevel {
  const fromEnv = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (fromEnv && fromEnv in LEVEL_RANK) {
    return fromEnv as LogLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel()];
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

function write(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "phone-telnyx",
    env: process.env.NODE_ENV ?? "development",
    ...context,
  };

  const production = process.env.NODE_ENV === "production";

  if (production) {
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const prefix = `[${entry.timestamp}] ${level.toUpperCase()}`;
  if (context && Object.keys(context).length > 0) {
    console.log(prefix, message, context);
  } else {
    console.log(prefix, message);
  }
}

export type Logger = {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
};

function createLogger(bindings: Record<string, unknown> = {}): Logger {
  const withBindings = (context?: Record<string, unknown>) => ({
    ...bindings,
    ...context,
  });

  return {
    debug: (message, context) => write("debug", message, withBindings(context)),
    info: (message, context) => write("info", message, withBindings(context)),
    warn: (message, context) => write("warn", message, withBindings(context)),
    error: (message, context) => write("error", message, withBindings(context)),
    child: (extra) => createLogger(withBindings(extra)),
  };
}

export const logger = createLogger();

export function logError(
  log: Logger,
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  log.error(message, {
    ...context,
    error: serializeError(error),
  });
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

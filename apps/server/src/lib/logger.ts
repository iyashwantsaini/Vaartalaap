export const logger = {
  info: (message: string, ...args: unknown[]) => console.log(`[info] ${message}`, ...args),
  error: (message: string, ...args: unknown[]) => console.error(`[error] ${message}`, ...args),
};

const colors = {
  reset: "\x1b[0m",
  info: "\x1b[36m", // Cyan
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
  debug: "\x1b[35m", // Magenta
};

function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Custom logger replacing console.* for better formatting and colorization.
 */
export const logger = {
  info(message: string, ...optionalParams: unknown[]) {
    console.log(
      `[${getTimestamp()}] ${colors.info}[INFO]${colors.reset} ${message}`,
      ...optionalParams
    );
  },
  warn(message: string, ...optionalParams: unknown[]) {
    console.warn(
      `[${getTimestamp()}] ${colors.warn}[WARN]${colors.reset} ${message}`,
      ...optionalParams
    );
  },
  error(message: string, ...optionalParams: unknown[]) {
    console.error(
      `[${getTimestamp()}] ${colors.error}[ERROR]${colors.reset} ${message}`,
      ...optionalParams
    );
  },
  debug(message: string, ...optionalParams: unknown[]) {
    console.debug(
      `[${getTimestamp()}] ${colors.debug}[DEBUG]${colors.reset} ${message}`,
      ...optionalParams
    );
  },
};

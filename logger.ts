let _logger: {
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
  debug: (message: string, ...args: unknown[]) => void
} = {
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: () => {},
}

let _debugEnabled = false

export function initLogger(
  logger: typeof _logger,
  debug: boolean,
): void {
  _logger = logger
  _debugEnabled = debug
}

export const log = {
  info: (msg: string, ...args: unknown[]) => _logger.info(`nyne: ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => _logger.warn(`nyne: ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => _logger.error(`nyne: ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => {
    if (_debugEnabled) _logger.debug(`nyne: ${msg}`, ...args)
  },
  debugRequest: (method: string, params: Record<string, unknown>) => {
    if (_debugEnabled) _logger.debug(`nyne: → ${method}`, JSON.stringify(params))
  },
  debugResponse: (method: string, summary: Record<string, unknown>) => {
    if (_debugEnabled) _logger.debug(`nyne: ← ${method}`, JSON.stringify(summary))
  },
}

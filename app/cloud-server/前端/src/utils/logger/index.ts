const LEVEL_NAME_CN: Record<string, string> = {
  log: '信息',
  info: '信息',
  warn: '警告',
  error: '错误',
  debug: '调试',
}

const LEVEL_STYLE: Record<string, string> = {
  log: 'color: #2e7d32;',
  info: 'color: #2e7d32;',
  warn: 'color: #f9a825;',
  error: 'color: #c62828; font-weight: 600;',
  debug: 'color: #00acc1;',
}

function formatTime(): string {
  const now = new Date()
  const time = now.toLocaleTimeString('zh-CN', { hour12: false })
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `${time}.${ms}`
}

export function setupConsole(): void {
  if (typeof window === 'undefined' || !window.console) {
    return
  }
  const c = window.console
  const original = {
    log: c.log.bind(c),
    info: (c.info ?? c.log).bind(c),
    warn: (c.warn ?? c.log).bind(c),
    error: (c.error ?? c.log).bind(c),
    debug: (c.debug ?? c.log).bind(c),
  }
  const print = (level: keyof typeof original, args: any[]) => {
    const label = LEVEL_NAME_CN[level] ?? level
    const style = LEVEL_STYLE[level] ?? ''
    const prefix = `[${formatTime()}] `
    const levelTag = `%c[${label}]%c`
    const tail = ' []'
    original[level](`${prefix}${levelTag}${tail}`, style, 'color: inherit', ...args)
  }
  c.log = (...args: any[]) => print('log', args)
  c.info = (...args: any[]) => print('info', args)
  c.warn = (...args: any[]) => print('warn', args)
  c.error = (...args: any[]) => print('error', args)
  c.debug = (...args: any[]) => print('debug', args)
}

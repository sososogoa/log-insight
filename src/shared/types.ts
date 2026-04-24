export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'unknown'

export interface ServerProfile {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'pem' | 'password' | 'agent'
  pemPath?: string
  password?: string
  logPath?: string
  env?: 'prod' | 'dev' | 'staging' | 'local' | string
}

export interface LogSource {
  id: string
  serverId: string
  path: string
  label?: string
}

export interface LogLine {
  id: string
  sourceId: string
  timestamp: number
  level: LogLevel
  text: string
  raw: string
}

export interface FilterRule {
  id: string
  kind: 'include' | 'exclude'
  mode: 'plain' | 'regex'
  value: string
  caseSensitive?: boolean
  levels?: LogLevel[]
  enabled: boolean
}

export interface TerminalSession {
  id: string
  title: string
  cwd?: string
  shell?: string
  cols?: number
  rows?: number
}

export interface AiBridgeRequest {
  terminalId: string
  template?: string
  payload: string
  instruction?: string
}

export interface IpcEvents {
  'logs:line': LogLine
  'logs:error': { sourceId: string; message: string }
  'terminal:data': { terminalId: string; chunk: string }
  'terminal:exit': { terminalId: string; code: number }
}

export type IpcEventName = keyof IpcEvents

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
  localProjectPath?: string
  env?: 'prod' | 'dev' | 'staging' | 'local' | string
}

export type LogSourceSpec =
  | { kind: 'file'; path: string }
  | { kind: 'docker'; container: string; tail?: number; sudo?: boolean }
  | { kind: 'custom'; command: string; label: string }

export interface DockerContainer {
  name: string
  id: string
  image: string
  status: string
}

export interface DockerListResult {
  containers: DockerContainer[]
  /** sudo 없이 docker 실행이 안 돼서 sudo -n 으로 성공한 경우 true */
  sudoRequired: boolean
  /** docker 가 설치돼 있지 않거나 접근 자체가 불가능 */
  unavailable?: boolean
  error?: string
}

export interface LogLine {
  id: string
  sourceId: string
  timestamp: number
  level: LogLevel
  text: string
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
  payload: string
  instruction?: string
}

export interface BookmarkedLine {
  text: string
  level: LogLevel
  timestamp: number
  sourceLabel?: string
}

export interface Bookmark {
  id: string
  createdAt: number
  note?: string
  /** snapshot at bookmark time — survives source buffer rotation */
  lines: BookmarkedLine[]
}


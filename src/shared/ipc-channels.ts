export const Channels = {
  ServersList: 'servers:list',
  ServersSave: 'servers:save',
  ServersRemove: 'servers:remove',

  LogsSubscribe: 'logs:subscribe',
  LogsUnsubscribe: 'logs:unsubscribe',
  LogsLine: 'logs:line',
  LogsError: 'logs:error',

  TerminalCreate: 'terminal:create',
  TerminalWrite: 'terminal:write',
  TerminalResize: 'terminal:resize',
  TerminalDispose: 'terminal:dispose',
  TerminalData: 'terminal:data',
  TerminalExit: 'terminal:exit',

  AiBridgeSend: 'ai-bridge:send'
} as const

export type Channel = (typeof Channels)[keyof typeof Channels]

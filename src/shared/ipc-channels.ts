export const Channels = {
  ServersList: 'servers:list',
  ServersSave: 'servers:save',
  ServersRemove: 'servers:remove',

  LogsSubscribe: 'logs:subscribe',
  LogsUnsubscribe: 'logs:unsubscribe',
  LogsLine: 'logs:line',
  LogsLineBatch: 'logs:line-batch',
  LogsError: 'logs:error',

  TerminalCreate: 'terminal:create',
  TerminalWrite: 'terminal:write',
  TerminalResize: 'terminal:resize',
  TerminalDispose: 'terminal:dispose',
  TerminalData: 'terminal:data',
  TerminalExit: 'terminal:exit',

  AiBridgeSend: 'ai-bridge:send',

  DialogOpenFile: 'dialog:open-file',
  DialogOpenFolder: 'dialog:open-folder',
  SshListDir: 'ssh:list-dir',
  SshTest: 'ssh:test',
  SshDockerList: 'ssh:docker-list',

  BookmarksList: 'bookmarks:list',
  BookmarksSave: 'bookmarks:save',
  BookmarksRemove: 'bookmarks:remove',
  BookmarksClear: 'bookmarks:clear',
  BookmarksExport: 'bookmarks:export',

  ShellOpenInEditor: 'shell:open-in-editor'
} as const

export type Channel = (typeof Channels)[keyof typeof Channels]

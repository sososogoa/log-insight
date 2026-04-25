# LogInsight — Real-time Log Analysis Desktop App with AI Integration

Streams remote server logs via `tail -F` in real time and injects selected lines directly into the stdin of an AI CLI (`claude`, `codex`, `gemini`, etc.) running in the built-in terminal — all in one window.

## What makes this project unique

There are plenty of `tail -f` GUIs, but very few tools bridge "log line → agent prompt" in a single step. The differentiator is the **AI bridge**:

- Click log lines in the left viewer to select them
- Press `🤖 Ask AI` or use the keyboard shortcut → lines are written directly to the active terminal's stdin
- The terminal runs a real shell via `node-pty`, so Claude Code, Codex, and **any CLI that reads stdin** receives context instantly — no special integration needed

## Structure

```
src/
├── main/                Electron main (Node)
│   ├── index.ts         app boot, window creation
│   ├── ipc/register.ts  all IPC handler registrations
│   ├── ipc/servers.ts   server profile persistence (userData/servers.json)
│   ├── ipc/ai-bridge.ts log → terminal stdin routing
│   ├── ssh/log-stream.ts  ssh2-based tail -F stream
│   └── pty/pty-manager.ts  node-pty session manager
├── preload/index.ts     exposes window.api via contextBridge (sandbox: false)
├── shared/              types and IPC channel constants shared across main/preload/renderer
│   ├── types.ts
│   └── ipc-channels.ts
└── renderer/src/        React 18
    ├── App.tsx          3-column + bottom terminal grid layout
    ├── features/
    │   ├── servers/     server tree
    │   ├── logs/        viewer, filters, rows
    │   ├── terminal/    xterm.js multi-session terminal
    │   └── ai-bridge/   connection status
    ├── store/           Zustand (servers, logs, terminal)
    └── styles/index.css Tailwind + xterm styles
```

### IPC contract

All channel names are defined in a single place: the `Channels` constant in `src/shared/ipc-channels.ts`.
**When adding a new channel, always sync in this order: ipc-channels.ts → preload → main/ipc/register.**
Never write string literals directly.

### AI bridge flow

1. User selects log lines in `LogViewer` (`selected: Set<id>` in the `logs` store)
2. Click `🤖 Ask AI` → `window.api.aiBridge.send({ terminalId, instruction, payload })`
3. `main/ai-bridge.ts` assembles the instruction + payload string and calls `writePty(id, text)`
4. node-pty writes it to that session's stdin → the running `claude` process receives it as input

The terminal is the contract boundary. To avoid coupling to any specific AI CLI, only stdin is shared —
**no additional protocols (JSON/HTTP/OpenAI API/etc.) are added**. If this decision ever needs to change, document the rationale in the README.

## Dev commands

```bash
pnpm install       # first run — includes native rebuild of node-pty
pnpm dev           # electron-vite dev server (main/preload/renderer HMR)
pnpm typecheck     # type-check node + web simultaneously
pnpm build         # production bundle → out/
pnpm build:mac     # .dmg package (electron-builder)
```

### Notes

- **`sandbox: false`** — the preload uses Node APIs (node-pty, ssh2). The renderer must never use Node directly; always go through `window.api`.
- **Native dependency**: `node-pty` has a different ABI than Node when running under Electron. `electron-builder install-app-deps` (runs automatically in the postinstall hook) handles this. For manual rebuild: `pnpm rebuild node-pty --config.runtime=electron`.
- **CSS `@import`** must come **before** `@tailwind` directives or PostCSS/Vite will warn. See `styles/index.css`.
- **Log buffer cap**: `useLogsStore` in the renderer has `MAX_LINES=5000`, trimmed FIFO. For long-running streaming scenarios, consider disk rollover before increasing this value.

## Roadmap

- Phase 1 ✅ Skeleton — SSH stream · xterm terminal · AI bridge scaffold
- Phase 2 — Regex/level filters · multi-source concurrent subscribe · prompt template UI
- Phase 3 — Grouping · search · snapshot persistence (IndexedDB)
- Phase 4 — ERROR spike alerts · embedded MCP server (expose logs as a resource)

## Language / tone

All communication, code identifiers, and comments are in **English**.
Commit messages are English. Do not add `Co-Authored-By: Claude …` or "🤖 Generated with Claude Code" footers (per the repo owner's global git rules).

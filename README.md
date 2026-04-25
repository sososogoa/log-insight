# log-insight

Remote log streaming + AI-bridged terminal in one window.

SSH into a server, tail logs in real time, select lines, and inject them directly into a running AI CLI (`claude`, `codex`, `gemini`, etc.) — no copy-paste, no tab switching.

![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![electron](https://img.shields.io/badge/electron-31-blue)
![license](https://img.shields.io/badge/license-MIT-green)

---

## What it does

Most log GUI tools stop at viewing. log-insight closes the loop:

1. Connect to a remote server over SSH
2. Stream logs via `tail -F` in the left pane
3. Click to select lines of interest
4. Press `Ask AI` — selected lines are written to the active terminal's stdin
5. The AI CLI already running in that terminal receives them as input and responds

The terminal runs `node-pty`, a real shell. Any CLI that reads stdin works — no plugins, no API keys, no special integration required.

## Privacy — all data stays on your machine

**No data ever leaves your computer through this app.** There is no backend, no telemetry, no analytics, no cloud sync, and no license server.

- Server profiles (hostname, user, password) are saved to `~/<AppData>/log-insight/servers.json` on your local disk. Passwords are encrypted at rest using the OS keychain (`Electron safeStorage` / macOS Keychain / Windows DPAPI / libsecret on Linux).
- Log lines are held in memory only and discarded when you close the source.
- Bookmarks are stored locally in your app data directory.
- The AI bridge writes text to a terminal running on *your machine*. log-insight has no knowledge of what AI tool you use or what it returns.

The app makes two types of outbound connections: SSH to servers you explicitly add, and whatever your AI CLI does on its own. Both are entirely under your control.

## Stack

| Layer | Technology |
|---|---|
| Shell | Electron 31 |
| Renderer | React 18 + Zustand + Tailwind |
| Terminal | xterm.js + node-pty |
| SSH / log stream | ssh2 |
| Build | electron-vite + electron-builder |

## Getting started

```bash
# Prerequisites: Node >= 20, pnpm

pnpm install        # builds native deps (node-pty) automatically
pnpm dev            # dev server with HMR
```

```bash
pnpm typecheck      # type-check main + renderer
pnpm build:mac      # .dmg
pnpm build:win      # .exe installer
pnpm build:linux    # .AppImage
```

## How the AI bridge works

The bridge is intentionally thin. When you click "Ask AI":

```
selected log lines
      ↓
  instruction + payload assembled in main process (ai-bridge.ts)
      ↓
  writePty(terminalId, text)   ← node-pty stdin write
      ↓
  whatever CLI is running in that terminal receives it
```

No HTTP calls. No OpenAI/Anthropic SDK. No prompt is sent anywhere by this app. The terminal is the contract boundary — log-insight is agnostic to which AI tool you run.

## Project structure

```
src/
├── main/
│   ├── index.ts              app boot, window creation
│   ├── ipc/register.ts       all IPC handlers
│   ├── ipc/servers.ts        server profiles → userData/servers.json
│   ├── ipc/ai-bridge.ts      log → terminal stdin routing
│   ├── ssh/log-stream.ts     ssh2-based tail -F stream
│   └── pty/pty-manager.ts    node-pty session manager
├── preload/index.ts          contextBridge → window.api
├── shared/                   types + IPC channel constants
└── renderer/src/
    ├── features/
    │   ├── servers/           server tree
    │   ├── logs/              viewer, filter, virtual rows
    │   ├── terminal/          xterm.js multi-session
    │   └── ai-bridge/         connection status
    └── store/                 Zustand stores
```

## License

MIT

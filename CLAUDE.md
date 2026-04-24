# LogInsight — AI 연동 실시간 로그 분석 데스크탑 앱

원격 서버 로그를 `tail -F`로 실시간 스트리밍하고, 같은 창의 내장 터미널에서
돌아가는 AI CLI(`claude`, `codex`, `gemini` 등)에 선택한 로그를 바로 주입해
원인 분석/수정 제안을 받는 Electron 앱.

## 이 프로젝트의 독자성

`tail -f` GUI는 많지만, "로그 → 에이전트 프롬프트"까지 1-step으로 연결된 도구는
드물다. 이 앱의 차별점은 **AI 브릿지**이다.

- 좌측 로그 뷰어에서 라인 클릭으로 선택
- 상단 `🤖 Ask AI` 버튼 또는 단축키 → 활성 내장 터미널의 stdin으로 바로 주입
- 터미널은 `node-pty` 기반 실제 셸이라 Claude Code / Codex 등 **표준 입력을 읽는
  모든 CLI**가 곧바로 컨텍스트를 받는다 (별도 연동 필요 없음)

## 구조

```
src/
├── main/                Electron main (Node)
│   ├── index.ts         앱 부트, 창 생성
│   ├── ipc/register.ts  모든 IPC 핸들러 등록 지점
│   ├── ipc/servers.ts   서버 프로필 영속화 (userData/servers.json)
│   ├── ipc/ai-bridge.ts 로그 → 터미널 stdin 라우팅
│   ├── ssh/log-stream.ts  ssh2 기반 tail -F 스트림
│   └── pty/pty-manager.ts  node-pty 세션 매니저
├── preload/index.ts     contextBridge로 window.api 노출 (sandbox: false)
├── shared/              main/preload/renderer 공유 타입·채널 상수
│   ├── types.ts
│   └── ipc-channels.ts
└── renderer/src/        React 18
    ├── App.tsx          3열 + 하단 터미널 그리드 레이아웃
    ├── features/
    │   ├── servers/     서버 트리
    │   ├── logs/        뷰어·필터·행
    │   ├── terminal/    xterm.js 기반 멀티 세션 터미널
    │   └── ai-bridge/   연결 상태 표시
    ├── store/           Zustand (servers, logs, terminal)
    └── styles/index.css Tailwind + xterm 스타일
```

### IPC 계약

모든 채널 이름은 `src/shared/ipc-channels.ts` 의 `Channels` 상수에서 단일 정의.
**새 채널을 추가할 때는 반드시 이 파일 → preload → main/ipc/register 순으로 동기화.**
문자열 리터럴을 직접 쓰면 안 된다.

### AI 브릿지 흐름

1. 사용자가 `LogViewer`에서 로그 라인 선택 (`logs` store의 `selected: Set<id>`)
2. `🤖 Ask AI` 클릭 → `window.api.aiBridge.send({ terminalId, instruction, payload })`
3. main `ai-bridge.ts` 가 instruction + payload 문자열을 조립해 `writePty(id, text)` 호출
4. node-pty가 해당 세션 stdin으로 써줌 → 터미널에서 돌던 `claude` 가 입력으로 받음

터미널은 "계약의 경계"다. 특정 AI CLI에 종속되지 않기 위해 stdin만 공유하고
**JSON/HTTP/OpenAI API 등 별도 프로토콜을 추가하지 않는다**. 이 결정이 바뀌어야
할 때는 README에 근거를 남길 것.

## 개발 명령어

```bash
pnpm install       # 최초 1회. node-pty 네이티브 리빌드 포함
pnpm dev           # electron-vite dev (main/preload/renderer HMR)
pnpm typecheck     # node + web 타입체크 동시 수행
pnpm build         # out/ 에 프로덕션 번들
pnpm build:mac     # dmg 패키지 (electron-builder)
```

### 주의

- **`sandbox: false`** 로 preload가 Node API를 쓴다(node-pty, ssh2). 렌더러
  프로세스는 절대 Node를 직접 쓰지 말고 `window.api` 만 사용.
- **네이티브 의존성**: `node-pty` 는 Electron 버전과 Node ABI가 달라 `electron-builder
  install-app-deps` (postinstall 훅에 자동) 가 실행돼야 한다. 수동 리빌드가
  필요하면 `pnpm rebuild node-pty --config.runtime=electron` 형태로 실행.
- **CSS `@import`** 는 `@tailwind` 지시문 **앞**에 와야 PostCSS/Vite가 경고를
  내지 않는다. `styles/index.css` 참고.
- **로그 버퍼 상한**: 렌더러 `useLogsStore`는 `MAX_LINES=5000`. 메모리 팽창을
  막기 위해 FIFO로 잘라낸다. 장시간 스트리밍 시나리오에서 이 값을 늘리기보다
  디스크 롤오버를 먼저 고려.

## 향후 계획 (impeccable.md와 별개, 기능 로드맵)

- Phase 1 ✅ 뼈대 — SSH 스트림·xterm 터미널·AI 브릿지 스켈레톤
- Phase 2 — 필터 정규식/레벨·다중 소스 동시 구독·프롬프트 템플릿 UI
- Phase 3 — 그룹화·검색·스냅샷 저장 (IndexedDB)
- Phase 4 — ERROR 감지 알림·MCP 서버 내장(로그를 resource로 노출)

## 언어 / 톤

사용자와의 커뮤니케이션은 **한국어**로 한다. 커밋 메시지는 한국어 허용하되
코드 식별자·주석은 영어. 커밋에 `Co-Authored-By: Claude …` 와 "🤖 Generated with
Claude Code" 푸터를 **추가하지 않는다** (사용자의 전역 Git 규칙).

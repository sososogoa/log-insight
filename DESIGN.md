---
name: LogInsight
description: Realtime remote log streaming with AI-bridged terminal
colors:
  surface-terminal: "#000000"
  surface-deep: "#0a0a0a"
  surface-panel: "#171717"
  surface-elevated: "#262626"
  border-subtle: "#262626"
  text-primary: "#e5e5e5"
  text-secondary: "#a3a3a3"
  text-muted: "#737373"
  text-faint: "#525252"
  accent-action: "#2563eb"
  accent-hover: "#3b82f6"
  accent-selection-bg: "#172554"
  status-connected: "#4ade80"
  log-info: "#60a5fa"
  log-warn: "#fbbf24"
  log-error: "#f87171"
  log-debug: "#94a3b8"
  log-trace: "#64748b"
typography:
  mono:
    fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace"
    fontSize: "13px"
    lineHeight: "20px"
    fontWeight: 400
  label:
    fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.1em"
  body:
    fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.5"
  heading:
    fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "1.5"
rounded:
  sm: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent-action}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  button-tab-active:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  button-tab-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  input-filter:
    backgroundColor: "{colors.surface-panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

# Design System: LogInsight

## 1. Overview

**Creative North Star: "The Terminal Mind"**

A backend engineer sits at 11pm, terminal glowing on a dark desk, watching deployment logs stream by, waiting for the pattern that explains why staging broke twenty minutes ago. This is the physical scene. Dark is not a style choice here — it is the only honest answer. The ambient light is the screen itself.

LogInsight is not a dashboard. It does not try to be beautiful in the way that marketing tools are beautiful. It tries to be invisible in the way that a well-worn keyboard is invisible: you stop noticing it and start noticing the work. The log stream is the product. The UI's job is to stay out of the way, surface signal from noise, and hand context to the AI in a single gesture.

Every pixel follows from this. Mono throughout, because developers read monospace. Minimal radius, because softness implies consumer. Flat surfaces, because elevation is theater when there is no hierarchy to express. Color reserved for signal — log levels, action states, connection status — never for decoration. The interface speaks only when spoken to.

This system explicitly rejects the heaviness of legacy observability tools: Splunk-style panel sprawl, gray gradients, cluttered toolbars. It rejects the warmth of consumer app design: oversized cards, saturated palettes, marketing-flavored empty states. If someone mistakes this for a SaaS landing page, the design has failed.

**Key Characteristics:**
- Monospace-only typography: every glyph aligns, every column is a column
- Six-step tonal depth with no shadows: surfaces distinguish by darkness, not elevation
- Focus Sapphire accent appears in at most 10% of any screen
- Semantic color for log levels only: meaning, never decoration
- Sub-4px radius everywhere: this is a tool, not an app store listing
- 80ms hover transitions at most: the interface should feel immediate, not animated

## 2. Colors: The Tonal Stack

Six neutral steps plus semantic overrides. Restraint is the doctrine.

### Primary
- **Focus Sapphire** (`#2563eb` / oklch(48% 0.21 264)): The single action color. Appears on interactive elements that demand a deliberate choice: the "Ask AI" button, focus rings on inputs, the active terminal tab background. Never used decoratively. If you are tempted to use it for a heading, a divider, or a hover effect that is not an action, use `text-muted` instead.
- **Focus Sapphire Hover** (`#3b82f6` / oklch(58% 0.21 264)): The hover state of the primary action. Lighter, not darker — the button gets closer to you on hover.

### Secondary
- **Selection Midnight** (`#172554` / oklch(22% 0.085 264)): The background tint for a selected log row. Never as a border, never as text. Background only.
- **Status Green** (`#4ade80` / oklch(77% 0.20 145)): Connection confirmed. A small dot, nothing else. Never used beyond AI bridge status.

### Tertiary — Log Level Semantics
These are semantic, not aesthetic. They do not "go with" the palette; they are distinct from it by design. A reader scanning 5,000 lines reads color first. Do not reassign these hues to non-log contexts.

- **Info Blue** (`#60a5fa`): INFO level. Deliberately close to Focus Sapphire but lighter — they share a hue family, not a function.
- **Warn Amber** (`#fbbf24`): WARN level. The only warm hue in the system.
- **Error Red** (`#f87171`): ERROR level. The most urgent color. Appears only when something failed.
- **Debug Slate** (`#94a3b8`): DEBUG level. De-emphasized; developers filter this out.
- **Trace Slate** (`#64748b`): TRACE level. Near-muted. Background noise.

### Neutral
The base of everything. A six-step tonal stack moving from near-black to near-white. No step is used for decoration.

- **Terminal Floor** (`#000000`): The xterm.js terminal background. True black. Intentionally the darkest surface — the terminal is the realest space.
- **Deep Surface** (`#0a0a0a`): The application background. One step above true black.
- **Panel Surface** (`#171717`): Panel backgrounds, input backgrounds, filter rule items. Where content sits.
- **Elevated Surface / Border** (`#262626`): Active tab backgrounds, hover states, all structural borders and dividers. One surface reads as elevated when its background is #262626 against a #171717 base.
- **Muted Text** (`#737373`): Section labels, status lines, placeholder text.
- **Secondary Text** (`#a3a3a3`): Inactive tab labels, secondary metadata, `user@host` strings.
- **Primary Text** (`#e5e5e5`): All foreground content that the user must read. Never pure white.

### Named Rules

**The Tonal Elevation Rule.** There are no shadows in this system. Depth is expressed only by which neutral step a surface occupies. A surface at `#262626` reads as elevated above `#171717`. Introduce a shadow and you introduce theater.

**The One Voice Rule.** Focus Sapphire appears on at most 10% of any given screen. The rest is neutral. The color's rarity is what makes it readable as signal. If the blue is everywhere, nothing matters.

**The Semantic Firewall Rule.** Log level colors (Info Blue, Warn Amber, Error Red, Debug Slate, Trace Slate) are reserved exclusively for log lines and level-specific UI. Using Warn Amber for a heading, a chip, or a status badge is prohibited. The palette stays readable at 5,000 lines because each hue has exactly one meaning.

## 3. Typography: The Single Voice

**Display/Body/Label Font:** JetBrains Mono (with SF Mono, ui-monospace, monospace fallback)

**Character:** One typeface, one voice. There is no display font, no humanist sans, no editorial pairing. The entire interface speaks in monospace because the content it serves — log output, terminal I/O, server addresses, filter expressions — is monospace. Switching to a proportional font for labels would introduce dissonance.

### Hierarchy

- **Heading** (500 weight, 12px, 1.5 line-height): Panel titles used sparingly. font-weight 500 against the 400-weight body creates the scale step without changing size.
- **Body** (400 weight, 14px, 1.5 line-height): Server names, filter values, general UI text.
- **Mono / Log** (400 weight, 13px, 20px line-height): Log output. 13px specifically — large enough to scan fast, small enough to see 40+ lines at once. The 20px line height creates vertical rhythm in the stream.
- **Label** (400 weight, 11px, 0.1em tracking, uppercase): Section headings ("Servers", "Filters"), metadata lines, footer status. Tracking creates legibility at 11px without increasing weight. Uppercase is intentional: these are not headings, they are labels. Never apply uppercase to log output or user-authored content.

### Named Rules

**The Mono Supremacy Rule.** No sans-serif, no serif, no fallback to system-ui, no `font-sans`. If a future surface seems to need a different face — marketing copy, onboarding text, tooltips — that surface has drifted out of scope for this design system. Raise the question rather than silently break the rule.

**The Scale Rule.** The type scale has exactly two visual sizes: 13–14px (content) and 11px (labels). Adding a 16px or 18px heading makes the interface feel like a consumer app. Hierarchy is conveyed through weight, case, and tracking — not size.

## 4. Elevation

This system is flat by doctrine. No `box-shadow`, no `drop-shadow`, no `backdrop-filter`. The tonal stack in the Colors section is the entire elevation vocabulary.

Depth is conveyed by which neutral step a surface occupies:
- `#000000` (terminal) is the deepest floor
- `#0a0a0a` is the base canvas
- `#171717` is raised panel / input
- `#262626` is elevated control / active state / divider

A hovering element does not cast a shadow — it shifts its background one step toward `#262626`. An active tab does not lift; it fills with `#262626` while inactive tabs stay transparent.

**The Flat-By-Default Rule.** Surfaces are flat at rest. If you want to express that something is interactive, use a background shift on hover, not a shadow. If you want to express that something is selected, use a background tint (`#172554`), not a border stripe. Shadows appear only if a floating element (dropdown, tooltip, context menu) genuinely needs to separate from the layer below — and even then, keep the shadow ambient and dark (`0 4px 16px rgba(0,0,0,0.6)`).

## 5. Components

### Buttons

Surgical. No radius beyond 4px. Transition at 80ms.

- **Shape:** Gently squared (4px radius)
- **Primary (Ask AI):** Focus Sapphire background (`#2563eb`), white text, 11px mono, `2px 8px` padding. This is the highest-priority action in the UI. It appears only when logs are selected — never persistent.
- **Hover:** Background lightens to `#3b82f6` in 80ms. No transform, no glow.
- **Focus:** 2px `#3b82f6` outline, 2px offset. Keyboard users must see it clearly.
- **Disabled:** 40% opacity. `cursor: not-allowed`. This state is shown when no terminal is active.
- **Ghost / Tab:** Transparent background, `#a3a3a3` text when inactive. `#262626` fill, `#e5e5e5` text when active. No border on either state.

### Terminal Tabs

The tab bar is the navigation layer for terminal sessions. Tabs are minimal buttons with no underline, no top-border accent, no indicator stripe.

- **Active:** `bg-neutral-800` (`#262626`), primary text
- **Inactive:** Transparent, secondary text, hover shifts to `bg-neutral-900` (`#171717`)
- **New Tab (+):** Text-only, muted, no background. Hover brightens text to primary.

**The No-Stripe Rule.** Terminal tabs do not use a top or bottom colored border to indicate active state. The background fill is sufficient.

### Log Rows

The densest surface. Every pixel counts.

- **Layout:** `px-3 py-0.5` (12px horizontal, 2px vertical). Monospace 13px, 20px line-height. Text wraps and breaks on long lines — no horizontal scroll.
- **Level color:** Applied as text color only. No background tint per level — that would compete with the selection state.
- **Hover:** `bg-neutral-900` (`#171717`). Immediate, no transition.
- **Selected:** `bg-blue-950/40` (`rgba(23, 37, 84, 0.40)`) background tint only. No left border, no indicator stripe.

**The Selection Tint Rule.** Selected log rows use a background tint only (`#172554` at 40% opacity). A `border-left` stripe on a selected row is prohibited — it is a side-stripe border on a list item. The tint alone distinguishes selection clearly. A left border introduces uneven indentation that misaligns the monospace column grid.

### Filter Input

- **Style:** `bg-neutral-900` background, `border-neutral-800` border, 4px radius, `px-2 py-1` (8px/4px), 12px mono.
- **Focus:** `ring-1 ring-blue-500` — the Focus Sapphire ring appears. Outline is removed (`focus:outline-none`).
- **Placeholder:** `#737373` text — muted, but legible enough to convey syntax hint.

### Filter Rule Chips

Active filter rules rendered as list items, not floating chips.

- **Style:** `bg-neutral-900` background, 4px radius, `px-2 py-1`, 12px mono. No border in the default state.
- **Controls:** Checkbox (enabled), select for include/exclude kind, select for plain/regex mode. Controls are minimal — `bg-neutral-950` fills with `border-neutral-800` border.
- **Remove:** `×` button, muted text (`#737373`), hover shifts to `#f87171` (Error Red). The only use of a log-level color outside a log context — justified because deletion is destructive.

### Section Labels

A distinct non-component that structures panel content.

- 11px mono, uppercase, `tracking-wider` (0.1em), `#737373` muted text.
- No border, no separator line, no icon.
- `px-2 py-1` padding — aligned with list items below it.

### Status Indicators

Inline text-based status. No badges, no pills, no cards.

- **Connected:** `● connected to terminal` in `#4ade80` (Status Green). The bullet is the indicator.
- **Disconnected:** `○ no active terminal` in `#525252` (faint text). The hollow circle signals absence.
- Never uses background tints, icon badges, or floating overlays for status.

## 6. Do's and Don'ts

### Do:
- **Do** use monospace (JetBrains Mono) for every text element without exception. The interface is one typeface.
- **Do** express elevation through background steps (`#000000` → `#171717` → `#262626`). No shadows.
- **Do** reserve Focus Sapphire (`#2563eb`) for interactive actions: buttons, focus rings, active states. Nothing else.
- **Do** convey log level identity through text color alone. INFO, WARN, ERROR, DEBUG colors are semantic contracts.
- **Do** show selection state as a background tint (`bg-blue-950/40`). Background only, no borders.
- **Do** keep hover transitions at 80ms or under. The interface must feel immediate.
- **Do** use 11px uppercase tracked labels for section headers. This is the only decorative treatment in the system, and it is minimal.
- **Do** keep button radius at 4px. No rounded-full, no rounded-lg.

### Don't:
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent on any list item, log row, tab, or callout. This is an absolute ban. Rewrite with background tints.
- **Don't** use gradient text (`background-clip: text`). Never intentional here.
- **Don't** use shadows except for truly floating surfaces (dropdowns, context menus) where tonal separation is impossible.
- **Don't** introduce a sans-serif or proportional font for any surface — not for tooltips, not for onboarding, not for error messages.
- **Don't** use log level colors (Info Blue, Warn Amber, Error Red, Debug Slate) for any non-log UI element. These colors carry meaning from 5,000-line streams. Reassigning them destroys that meaning.
- **Don't** use oversized cards with icon, heading, and body text. This is consumer-app structure. If content needs grouping, use a flat list with a section label.
- **Don't** create modal dialogs as a first response to any interaction. Exhaust inline alternatives before introducing a layer.
- **Don't** make the UI feel like a heavy Enterprise observability tool (Splunk-style panel sprawl, gray gradients, toolbar overload). Every element present must earn its place.
- **Don't** use bright or warm colors for decorative purposes. The only warm hue in the system is Warn Amber (`#fbbf24`), and it means WARN. Nothing else is warm.
- **Don't** animate layout properties. Transitions on `background-color` and `opacity` only.

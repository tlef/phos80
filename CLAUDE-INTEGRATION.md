# phos80 — integration instructions for AI coding agents

You are integrating **phos80**, a server-driven retro terminal UI library, into a host application. Read this first, then consult [USAGE.md](USAGE.md) (embedding/config/theming/SSR) and [PROTOCOL.md](PROTOCOL.md) (the JSON + BBCode contract) in this same package directory.

## Install

```
npm i github:tlef/phos80
```

Entry points (ESM, zero dependencies, no build step):

```js
import { createTerminal } from 'phos80/client';   // browser: mount the terminal
import { renderScreen } from 'phos80/ssr';        // Node: prerender docs to HTML
import { themeCSS, THEMES } from 'phos80/themes'; // palettes; inline vars for SSR
import 'phos80/phos80.css';                       // styles (or a <link> tag)
```

TypeScript declarations ship with the package: `phos80/protocol` exports `Doc`, `Widget`, `Envelope` — use them to type API handlers.

## Hard rules

1. **Never modify files inside the phos80 package.** If the framework seems to need a change, stop and tell the user — changes happen in the phos80 repo (github.com/tlef/phos80), not in a patched copy.
2. **All content lives in the host app.** phos80 renders documents; it must never be given hardcoded app content to carry. Welcome screens, help text, headers, error phrasing — all authored in the host app and delivered as protocol docs.
3. **The API speaks protocol JSON** (see PROTOCOL.md): every command resolves to an envelope `{ ok, doc, header? }` where `doc` is `{ widgets: [...] }`. Text content uses the BBCode-style whitelist (`[red]`, `[b]`, `[dim]`, `[link=…]`). Side-by-side layout is the `columns` widget; the API never reasons about pixels or viewport widths.

## Minimal integration (three pieces)

**1. Mount (browser).** One element, no sizing CSS needed — the terminal fills the viewport and the page scrolls like a normal website by default:

```js
const term = createTerminal({
  mount: document.getElementById('terminal'),
  transport: async (cmd) => {
    const r = await fetch('/api/cmd', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cmd }),
    });
    return r.json();
  },
  initialDoc,                       // the doc the server prerendered
  chrome: { placeholder: 'type help', header: defaultHeaderDoc },
});
```

React/TSX wrapper: mount in `useEffect`, return `term.destroy()` as cleanup, and put server-prerendered skeleton HTML in the mount via `dangerouslySetInnerHTML` (React treats it as opaque; `createTerminal` adopts a `[data-p80="crt"]` skeleton in place — StrictMode-safe). Mark the component client-only (`'use client'`).

**2. Endpoint (server).** One route: command string in → envelope out. Handlers build widget JSON from real app data, using the app's normal auth/session/db:

```ts
import type { Envelope } from 'phos80/protocol';
// POST /api/cmd  { cmd: string } → Envelope
```

**3. SSR (optional but recommended for SEO).** `renderScreen(doc, { cols: 80 })` in any Node context returns the exact HTML the client renders; embed it inside the skeleton's `.p80-screen` (copy the skeleton shape from this package's demo at `demo/index.html`). For a non-default theme, inline `themeCSS('green')` on the mount to avoid a flash.

## Key facts that prevent common mistakes

- `'amber'` in the protocol/themes means *default foreground color*, whatever hue the active theme gives it.
- Theme presets: `amber`, `green`, `white`, `ice`. A configured `theme` is applied as inline CSS variables and **overrides** site CSS `--p80-*` overrides — pick one mechanism, not both.
- `settings.scrolling`: `'document'` (default — page grows, browser scrolls) vs `'viewport'` (fixed screen, internal scrollback). BBS `page` mode always uses the fixed viewport.
- Runtime control: `term.setTheme()`, `term.configure({ typeCps, borderSet, … })`, `term.setMode()`, `term.setHeader()`, `term.print(doc)`, `term.dispatch(cmd)`.
- Local (client-side) commands go in `commands: {}` config; anything unlisted goes to the transport. Built-ins `clear` and `mode` are on by default.
- Layout vocabulary beyond the obvious: `columns` for side-by-side panels that stack when narrow, `row` for parts pushed to a line's edges (status lines, dot leaders), `code` for source listings (no soft-wrap, indent kept, over-wide lines continue on the next row with a marker; colour it yourself with inline tags, `gutter: true` for line numbers), and a `margin` (cells) accepted by every widget. Frame `title`s take inline markup and are plain unless you style them; `color` tints the border.
- `image` widgets reserve real grid rows, so give them `height` (rows) or `aspect` (intrinsic width/height) — without one, a server prerender guesses and the client reflows after measuring the file.
- `vector` widgets are drawings as data (`viewBox` + a `shapes` list of `path`/`points`/`line`/`rect`/`circle`/`text`), rendered inline as SVG in the theme's palette. Give one a fixed `height` (rows) and a `focus` (a rect that must stay visible, or a point) and it re-crops around the focus at every width instead of squashing — use it for maps and diagrams. Never send raw SVG markup; it is not accepted.
- Responses can install a persistent page-mode masthead via the envelope's `header` field (`null` restores the default).
- Character widths are one cell per character (ASCII + box drawing); emoji/CJK are not width-aware.
- After changing served JS modules during development, browsers cache aggressively — hard-refresh when the terminal seems dead (a dead module graph leaves the static SSR content visible but commands non-functional).
- The reference implementation is `demo/` in this package — a complete working site against a mock API. When unsure how to wire something, read the demo.

# phos80

A server-driven retro terminal UI for the web. Sites supply JSON documents (widget trees + BBCode-style inline markup); phos80 renders them as a responsive phosphor-CRT terminal — frames, alignment and columns drawn with **real characters** (box glyphs and padding spaces), re-laid-out from the document model on every resize. Links and buttons are real focusable elements; commands typed at the prompt go through a single `transport` function to your API. No dependencies, no build step.

The name: **phos**phor + **80** — the eighties, and 80 columns. Everything the framework touches is prefixed `p80-` (CSS classes, data attributes, `--p80-*` theme variables).

- **[USAGE.md](USAGE.md)** — how to embed it, configure it, theme it, SSR it.
- **[PROTOCOL.md](PROTOCOL.md)** — the JSON + BBCode contract your API speaks.
- **`phos80/`** — the framework (content-free). TypeScript declarations in `types/`.
- **`demo/`** — a complete reference site with a mock API.

## Install

```
npm i github:tlef/phos80
```

```js
import { createTerminal } from 'phos80/client';   // browser
import { renderScreen } from 'phos80/ssr';        // Node (SSR)
import 'phos80/phos80.css';                       // via a bundler
```

Or skip npm entirely — the framework is plain ES modules; copy `phos80/` and load it with `<script type="module">`.

## Run the demo

```
npm run demo          # or: python3 -m http.server 8000
open http://localhost:8000/demo/
```

Try `help`, `about`, `news 1`, `mode page`, `clear` — then resize the window and watch the frames redraw at the new width.

## Design in one breath

One pure, isomorphic pipeline: `doc JSON → layout(doc, cols) → styled lines → escaped HTML`. The client keeps document models (never rendered strings) and re-runs the pipeline when the measured column count changes; the identical code runs in Node for SEO prerenders (`phos80/ssr.js`). Content and framework never mix: the demo is the proof.

After editing demo content, regenerate the prerendered page:

```
npm run gen-ssr
```

# Phosphor · project-80s

A retro-terminal UI framework for websites. Sites supply JSON documents (widget trees + BBCode-style inline markup); Phosphor renders them as a responsive amber-phosphor CRT terminal — frames, alignment and columns drawn with **real characters** (box glyphs and padding spaces), re-laid-out from the document model on every resize. Links and buttons are real focusable elements; commands typed at the prompt go through a single `transport` function to your API. No dependencies, no build step.

- **[USAGE.md](USAGE.md)** — how to embed it, configure it, theme it, SSR it.
- **[PROTOCOL.md](PROTOCOL.md)** — the JSON + BBCode contract your API speaks.
- **`phosphor/`** — the framework (content-free).
- **`demo/`** — a complete reference site with a mock API.

## Run the demo

```
python3 -m http.server 8000
open http://localhost:8000/demo/
```

Try `help`, `about`, `news 1`, `mode page`, `clear` — then resize the window and watch the frames redraw at the new width.

## Design in one breath

One pure, isomorphic pipeline: `doc JSON → layout(doc, cols) → styled lines → escaped HTML`. The client keeps document models (never rendered strings) and re-runs the pipeline when the measured column count changes; the identical code runs in Node for SEO prerenders (`phosphor/ssr.js`). Content and framework never mix: the demo is the proof.

After editing demo content, regenerate the prerendered page:

```
node tools/gen-ssr.mjs
```

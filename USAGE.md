# Using phos80

phos80 is a server-driven retro terminal UI library for websites. Your site supplies **documents** (JSON widget trees with BBCode-style inline markup, see [PROTOCOL.md](PROTOCOL.md)); phos80 renders them as a responsive amber-phosphor character terminal — frames and alignment drawn with real box glyphs and padding spaces, reflowed on resize, with clickable links/buttons, a command prompt, and optional SSR.

phos80 contains **no content**. Every screen the visitor sees comes from your site: the initial doc, the transport responses, and a few chrome docs. The `demo/` directory is a complete reference site.

## 1. Include it

```html
<link rel="stylesheet" href="phos80/phos80.css">
<div id="terminal"></div>
<script type="module">
  import { createTerminal } from 'phos80/client';

  const term = createTerminal({
    mount: document.getElementById('terminal'),
    transport: async (cmd) => {
      const r = await fetch('/api/cmd', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cmd }),
      });
      return r.json();            // → a protocol envelope, see PROTOCOL.md
    },
  });
</script>
```

No host CSS is required: by default the terminal fills the viewport and grows with its content (the browser scrolls the page, like a normal website). For a fixed app-style screen with internal scrollback, set `settings: { scrolling: 'viewport' }` — and size it by overriding `.p80-crt { height: … }` if you're embedding it smaller than the viewport. If `mount` is empty, phos80 builds its own skeleton; if it contains a server-prerendered skeleton (§5), phos80 adopts it in place.

The `phos80/client` specifiers come from installing via npm (`npm i github:tlef/phos80`), which also brings TypeScript declarations — including `phos80/protocol` types (`Doc`, `Widget`, `Envelope`) for compile-time checking of API handlers. Without npm, use relative paths (`./phos80/client.js`); the framework is plain ES modules.

## 2. The contract in one paragraph

Every command the visitor types (or button they click) is passed to your `transport`, which must resolve to `{ ok, doc, header? }`. The `doc` is a widget tree — `text` (with alignment), `frame`, `columns` (side-by-side panels that stack when narrow), `buttons`, `image` (inline, grid-snapped, CRT-treated), `rule`, `spacer` — and text content uses BBCode-style tags for color/bold/links. "This frame on the left, that one on the right" is:

```json
{ "type": "columns", "widths": [1, 1], "min": 30, "children": [
    { "type": "frame", "title": "LEFT",  "children": [ … ] },
    { "type": "frame", "title": "RIGHT", "children": [ … ] }
] }
```

Full vocabulary and rules: [PROTOCOL.md](PROTOCOL.md).

## 3. Configuration

Everything except `mount` and `transport` is optional; values shown are the defaults.

```js
const term = createTerminal({
  mount, transport,                    // required
  initialDoc: null,                    // first screen (usually the prerendered doc)

  settings: {
    maxCols: 80,                       // grid clamp, in character cells
    minCols: 20,
    typeCps: 1000,                     // typewriter speed (chars/sec); 0 = instant
    maxScrollback: 1000,
    mode: 'scroll',                    // 'scroll' | 'page' (BBS-style full screens)
    scrolling: 'document',             // page grows & browser scrolls; 'viewport' = fixed
                                       //   screen w/ inner scroll (page mode always fixed)
    borderSet: 'unicode',              // 'ascii' draws frames with +--| instead of box glyphs
    autoFocus: true,                   // focus prompt on load/after commands (fine-pointer only)
    focusOnClick: true,                // clicking empty screen space focuses the prompt
    echo: true,                        // echo commands into the scrollback
    historyKey: null,                  // e.g. 'myapp' → ↑/↓ history persists in localStorage
    externalLinks: '_blank',           // target for http(s) links; '_self' for same tab
  },

  theme: 'green',                      // see §4; omit to use stylesheet defaults

  chrome: {                            // the few strings/docs the shell itself needs
    prompt: '>',
    placeholder: '',
    inputLabel: 'command input',       // aria-label for the input
    header: null,                      // default page-mode header doc (site content)
    colsBadge: true,                   // the "80 COLS" badge in the corner
    notices: {                         // BBCode strings or full docs
      modeScroll: 'display mode: [green][b]scroll[/b][/green]',
      modePage:   'display mode: [green][b]page[/b][/green]',
      modeUsage:  '[red]usage:[/red] mode [green]scroll[/green]|[green]page[/green]',
    },
    errors: {
      transport: (err) => doc,         // shown when transport throws/rejects
    },
  },

  commands: {                          // client-side commands (never hit transport)
    clear: true,                       // built-ins; set false to send to transport instead
    mode: true,
    theme: (args, term) => doc | string | null,   // your own local commands
  },
});
```

Instance API: `term.dispatch(cmd)` · `term.print(doc)` · `term.setHeader(doc | null)` · `term.setMode('page' | 'scroll')` · `term.setTheme(theme | null)` · `term.clear()` · `term.focus()` · `term.remeasure()` · `term.mode` / `term.cols` (getters) · `term.destroy()`.

## 4. Theming

### Presets

Four palettes named after real CRT phosphors, each with its own temperature-tuned 16-color accent set: **`amber`** (P3, the default), **`green`** (P1 — Apple II/VT100), **`white`** (P4 paper-white), **`ice`** (blue-white).

```js
createTerminal({ theme: 'green', … })          // preset by name
term.setTheme('ice');                          // switch at runtime
term.setTheme(null);                           // back to stylesheet defaults
```

Granular form — override colors, tune the CRT effects:

```js
theme: {
  preset: 'green',
  colors: { bg: '#020805', cyan: '#8ff' },     // any palette key, or 'font'
  effects: {
    scanlines: 0.5,    // false | true | 0..1  ← the interlace lines
    glow: true,        // false | true | 0..1
    flicker: false,    // false disables the overlay flicker
    vignette: true,    // false | true | 0..1
  },
}
```

('`amber`' is the protocol's name for the *default foreground*, whatever hue the theme gives it — `[amber]` in BBCode always means "default text color".)

### CSS variables

With no `theme` configured, everything reads `--p80-*` custom properties which you can set from any CSS ancestor:

```css
#terminal { --p80-amber: #33ff66; --p80-bg: #020805; --p80-scanlines: 0; }
```

Available: `--p80-bg`, `--p80-bg-deep`, `--p80-amber`, `--p80-font`, the 16 palette names (`--p80-red`, `--p80-brwhite`, …), and effect intensities `--p80-scanlines` / `--p80-vignette` / `--p80-glow` (0..1). Precedence note: a configured `theme` is applied as inline styles on the mount and **wins over** site CSS — pick one mechanism.

### SSR without a theme flash

For a non-default theme, inline the same variables into the server markup:

```js
import { themeCSS } from 'phos80/themes';
`<div id="terminal" class="p80" style="${themeCSS('green')}">…skeleton…</div>`
```

All rendered classes are `p80-`prefixed; the component never styles the host page.

## 5. SSR / SEO

The rendering pipeline is isomorphic — no DOM. On any Node (server, build step, CI):

```js
import { renderScreen } from 'phos80/ssr';
const html = renderScreen(welcomeDoc, { cols: 80 });   // → HTML string
```

Embed that inside the skeleton's `.p80-screen` element (copy the skeleton shape from `demo/index.html`, or generate the page like `tools/gen-ssr.mjs` does). Crawlers and no-JS visitors see full content; on load, `createTerminal` adopts the skeleton and re-renders `initialDoc` at the visitor's true width.

Non-Node backends: emit protocol JSON at runtime (it's just JSON), and prerender at build time with the CLI:

```
node phos80/ssr.js page-doc.json 80 > screen.html
```

## 6. What your site is responsible for

- **One API endpoint**: command string in → envelope out. Any language.
- **Content docs**: welcome screen, headers, help text, error phrasing — all yours.
- **Optionally**: URL↔command mapping for deep links — wire your router to `term.dispatch()` and push history entries from your transport layer.

## 7. Run the demo

```
python3 -m http.server 8000        # from the repo root
open http://localhost:8000/demo/
```

Try `help`, `about` (columns), `news 1` (buttons + page-mode masthead via the `header` field), `mode page`, `clear` — and resize the window.

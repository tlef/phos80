# Using Phosphor

Phosphor is a retro-terminal UI framework for websites. Your site supplies **documents** (JSON widget trees with BBCode-style inline markup, see [PROTOCOL.md](PROTOCOL.md)); Phosphor renders them as a responsive amber-phosphor character terminal — frames and alignment drawn with real box glyphs and padding spaces, reflowed on resize, with clickable links/buttons, a command prompt, and optional SSR.

Phosphor contains **no content**. Every screen the visitor sees comes from your site: the initial doc, the transport responses, and a few chrome docs. The `demo/` directory is a complete reference site.

## 1. Include it

```html
<link rel="stylesheet" href="phosphor/phosphor.css">
<div id="terminal"></div>
<script type="module">
  import { createTerminal } from './phosphor/client.js';

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

Give the mount element a height (`#terminal { height: 100dvh }` for full screen). If `mount` is empty, Phosphor builds its own skeleton; if it contains a server-prerendered skeleton (§5), Phosphor adopts it in place.

## 2. The contract in one paragraph

Every command the visitor types (or button they click) is passed to your `transport`, which must resolve to `{ ok, doc, header? }`. The `doc` is a widget tree — `text` (with alignment), `frame`, `columns` (side-by-side panels that stack when narrow), `buttons`, `rule`, `spacer` — and text content uses BBCode-style tags for color/bold/links. "This frame on the left, that one on the right" is:

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
    typeCps: 10000,                    // typewriter speed (chars/sec); 0 = instant
    maxScrollback: 1000,
    mode: 'scroll',                    // 'scroll' | 'page' (BBS-style full screens)
  },

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

Instance API: `term.dispatch(cmd)` · `term.print(doc)` · `term.setHeader(doc | null)` · `term.setMode('page' | 'scroll')` · `term.clear()` · `term.focus()` · `term.remeasure()` · `term.mode` / `term.cols` (getters) · `term.destroy()`.

## 4. Theming

Every color reads a `--p80-*` custom property; override any of them on the mount (or any ancestor):

```css
#terminal { --p80-amber: #33ff66; --p80-bg: #020805; }   /* green phosphor */
```

Available: `--p80-bg`, `--p80-bg-deep`, `--p80-amber`, `--p80-font`, and the 16 palette names (`--p80-red`, `--p80-brwhite`, …). All rendered classes are `p80-`prefixed; the component never styles the host page.

## 5. SSR / SEO

The rendering pipeline is isomorphic — no DOM. On any Node (server, build step, CI):

```js
import { renderScreen } from './phosphor/ssr.js';
const html = renderScreen(welcomeDoc, { cols: 80 });   // → HTML string
```

Embed that inside the skeleton's `.p80-screen` element (copy the skeleton shape from `demo/index.html`, or generate the page like `tools/gen-ssr.mjs` does). Crawlers and no-JS visitors see full content; on load, `createTerminal` adopts the skeleton and re-renders `initialDoc` at the visitor's true width.

Non-Node backends: emit protocol JSON at runtime (it's just JSON), and prerender at build time with the CLI:

```
node phosphor/ssr.js page-doc.json 80 > screen.html
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

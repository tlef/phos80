# phos80 Protocol v1

The contract between a site's API and the phos80 terminal UI. A backend in any language can speak it: it is JSON plus a small inline markup syntax. The framework renders docs; it never defines what they say.

## 1. Envelope

Every transport response resolves to:

```jsonc
{
  "ok": true,             // informational; errors are still docs
  "doc": { "widgets": [ /* Widget[] — what to display */ ] },
  "header": { "widgets": [ … ] }   // optional, see §4
}
```

- `header` present with a doc → replace the sticky header.
- `header: null` → restore the site's default header.
- `header` absent → leave the current header unchanged.
  (The same rules apply if `header` is placed on the doc itself.)

## 2. Widgets

A doc is `{ "widgets": Widget[] }`. Widgets stack vertically; layout is computed at the client's current column count, so the API never reasons about pixels or viewport sizes.

**Every widget** additionally accepts `margin` — space reserved on the sides, in character cells: `"margin": 4` (both sides) or `"margin": [8, 2]` (left, right). The widget is laid out at the reduced width (wrapping, centering, frames etc. all respect it), and margins shrink proportionally at narrow viewports so content keeps at least 8 cells. Margins nest: a frame with a margin can contain children with margins.

### text
```jsonc
{ "type": "text", "content": "BBCode string", "align": "left" }
```
`align`: `left` (default) | `center` | `right`. `\n` splits paragraphs; long lines word-wrap.

### frame
```jsonc
{ "type": "frame", "title": "NEWS", "border": "single", "color": "red", "children": [ Widget… ] }
```
Box-drawn border around its children. `border`: `single` (default) | `double`. `color` tints the **border** (and is the title's default colour). `title` is embedded in the top border, bold, and accepts the same inline markup as text — so `"title": "[cyan]NEWS[/cyan]"` recolours just the title while the border keeps `color`. Frames nest.

### columns
```jsonc
{ "type": "columns", "children": [ Widget… ], "widths": [3, 2], "gap": 2, "min": 24 }
```
Side-by-side children — the terminal's flexbox. Each child is one column, laid out independently at its column width. `widths` are relative weights. As many columns as fit at `min` width share a row; extras wrap to the next row; at narrow viewports everything stacks full-width.

### row
```jsonc
{ "type": "row", "parts": ["[b]help[/b]", "this screen"], "fill": ".", "fillColor": "brblack" }
```
One line with its parts pushed to the edges — the status-bar / dot-leader idiom. The first part is flush left, the last flush right, and with exactly three parts the middle one is centred; remaining gaps are filled with `fill` (default a space; non-space fills render dim unless `fillColor` is given). Unlike `columns`, widths come from the content rather than a proportional split, so a short right-hand value never squeezes the left. If the parts can't fit on one line they stack, each keeping its edge alignment.

### buttons
```jsonc
{ "type": "buttons", "align": "left", "items": [ { "label": "NEXT", "command": "news 2", "color": "brwhite" } ] }
```
Rendered as `[ NEXT ]`, clickable/focusable; clicking dispatches `command` (default: lowercased label). Rows pack greedily and wrap.

### image
```jsonc
{ "type": "image", "src": "/img/x.jpg", "alt": "description",
  "width": 40, "height": 20, "align": "center",
  "treatment": "phosphor", "link": "/img/x-full.jpg" }
```
Inline image, snapped to the character grid: `width` in cells (default `min(40, cols)`, clamped to the viewport), `height` in rows — omit it and the client snaps to whole rows once the image loads (`object-fit: cover` absorbs the sub-row crop). `treatment`: `phosphor` (default — monochrome, tinted to the theme foreground, like it's drawn on the tube), `pixel` (adds chunky pixelation), `plain` (untouched). `link` wraps the image (URL or command, same rules as `[link=…]`). `src` may be http(s) or a scheme-less relative path. `alt` is required for accessibility and SEO. Images render through SSR as normal `<img>` tags; they are the one widget that isn't literal characters, so they don't copy as text.

### rule
```jsonc
{ "type": "rule", "char": "─", "color": "cyan" }
```
Full-width horizontal line. Dimmed unless `color` given.

### spacer
```jsonc
{ "type": "spacer", "lines": 1 }
```
Blank rows.

Unknown widget types render as a visible inline error (they do not throw).

## 3. Inline markup (BBCode-style)

Used inside any `content` string. Whitelist-only; unknown or unmatched tags render as literal text; all output is HTML-escaped — there is no way for content to inject markup.

| Tag | Effect |
|---|---|
| `[red]…[/red]` etc. | color; names: `amber`, `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `brblack`, `brred`, `brgreen`, `bryellow`, `brblue`, `brmagenta`, `brcyan`, `brwhite` |
| `[b]…[/b]` | bold |
| `[dim]…[/dim]` | faded |
| `[u]…[/u]` | underline |
| `[inv]…[/inv]` | inverse video |
| `[blink]…[/blink]` | blink (disabled under `prefers-reduced-motion`) |
| `[link=target]label[/link]` | link; see below |

Link targets:
- `https://…` / `http://…` → real anchor, opens in a new tab.
- `/path` → real same-site anchor (normal navigation).
- anything else (e.g. `help`, `news 2`) → dispatched as a command.

Tags nest and are restored on close (`[red]a [b]b[/b] c[/red]`). Styling survives word-wrap and alignment padding.

## 4. Header

The sticky strip above the screen, shown in **page mode**. It is an ordinary doc rendered without the typewriter effect. Responses install/replace/restore it via the `header` field (§1) — e.g. a news section installing a masthead that persists across its pages.

## 5. Display semantics (informative)

- **scroll mode**: each response appends to a scrollback (commands are echoed); **page mode**: each response replaces the screen, BBS-style. The mode is a client concern; the same docs work in both.
- Layout invariant: every rendered line is exactly the client's column count in visible characters; alignment and chrome are literal characters, so copied text pastes like real terminal output.
- Character widths are counted one cell per character (ASCII + box drawing). Emoji/CJK are not width-aware in v1.

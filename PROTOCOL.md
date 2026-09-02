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

### code
```jsonc
{ "type": "code", "content": "[magenta]const[/magenta] count = [yellow]1[/yellow];\n  [dim]// indented[/dim]", "gutter": true }
```
Preformatted source — `text` that must not reflow. `\n` separates lines and each line is one logical line of code, laid out verbatim: leading whitespace is kept, tabs expand to 4-column stops, and nothing soft-wraps at spaces (a `text` widget would eat the indent of a wrapped line, so a broken `return <button` reads like a new statement). `content` takes the same inline markup as `text`; that is how syntax colouring arrives, as colour tags from the producer — phos80 tokenises and highlights nothing. `gutter: true` prefixes dim right-aligned line numbers sized to the line count, inside the widget's width (`  7 │ …`, `|` with ASCII borders); it is dropped if fewer than 4 cells would remain for code.

**Over-wide lines continue on the next row**, indented to the original line's leading whitespace and prefixed with a dim `↪ ` (`> ` with ASCII borders). Two rows at 44 columns:
```
  return <button onClick={() => setCount(cou
  ↪ nt + 1)}>{label}</button>;
```
This is what a terminal does — `cat` at 44 columns wraps and never drops a character — and it is the only choice that keeps §5 intact *and* keeps every character of the source on screen: each row is exactly the column count, and a copy pastes as it would from a real terminal window, marker and indent included. A horizontal scroller would break the row invariant, and hard truncation would silently hide the tail of a line — for code the worst failure, since a missing `)` or `;` reads as a bug in the source rather than a display limit. The continuation prefix is capped so at least 8 cells of code (or the full width, if narrower) fit on every row; only when the width can't hold the marker plus that minimum is the marker dropped. Producers who want breaks to fall in sensible places break long lines themselves, as they would for any 80-column reader.

### frame
```jsonc
{ "type": "frame", "title": "NEWS", "border": "single", "color": "red", "children": [ Widget… ] }
```
Box-drawn border around its children. `border`: `single` (default) | `double`. `color` tints the **border** (and is the title's default colour). `title` is embedded in the top border and accepts the same inline markup as text — it renders as plain text unless styled, so `"title": "[b][cyan]NEWS[/cyan][/b]"` makes it bold and cyan while the border keeps `color`. Frames nest.

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
Inline image occupying a **rectangle of the grid**: `width` cells wide (default `min(40, cols)`, clamped to the viewport) and N rows tall, where N comes from `height` if given, else the image's measured shape, else the `aspect` hint (intrinsic width ÷ height, e.g. `0.667` for a 2:3 poster), else a square. Because those rows are real lines, frames draw borders down both sides of an image and columns stay aligned beside one; `object-fit: cover` absorbs the sub-row rounding.

Supply `height` or `aspect` for anything rendered server-side — otherwise the prerender guesses and the client reflows once it has measured the file (the same one-time correction the 80-column prerender makes for width).

`focus: [x, y]` (fractions 0–1 of the image's width and height) marks the subject: when `height` gives the image a different shape than its own, the cover-crop keeps that point in view instead of the centre — art direction for rasters. For a drawing that should re-crop *properly* at every width, see `vector`.

`treatment`: `phosphor` (default — monochrome, tinted to the theme foreground, like it's drawn on the tube), `pixel` (adds chunky pixelation), `plain` (untouched). `link` wraps the image (URL or command, same rules as `[link=…]`). `src` may be http(s) or a scheme-less relative path. `alt` is required for accessibility and SEO. Images render through SSR as normal `<img>` tags; they and `vector` are the widgets that aren't literal characters, so they copy as a blank rectangle.

### vector
```jsonc
{ "type": "vector", "viewBox": [0, 0, 1000, 600], "alt": "Survey chart of the island",
  "height": 18, "focus": [420, 280, 110, 110], "align": "center",
  "shapes": [
    { "points": [[180, 300], [220, 200], [300, 140]], "close": true, "fill": "bg" },
    { "path": "M 560 320 L 590 270 L 620 320", "dim": true },
    { "line": [700, 560, 900, 560] },
    { "rect": [40, 500, 300, 70] },
    { "circle": [470, 330, 6], "fill": "bryellow", "stroke": "none" },
    { "points": [[250, 310], [470, 330]], "stroke": "cyan", "dash": true },
    { "text": "PHOSPHOR CITY", "at": [482, 330], "bold": true }
  ] }
```
A drawing made of shapes, rendered inline as SVG in the theme's palette — the vector-display counterpart of `image`. It reserves a rectangle of the grid the same way (`width` cells, default the full width; `height` rows, else derived from the viewBox's shape), and layout computes, from the model, which **window** of the drawing that rectangle shows. The crop is re-chosen at every column count exactly as text re-wraps, so a narrower terminal shows a different part of the drawing rather than a squashed one. Because the picture is recoloured from the palette, it follows `theme` changes like any text.

`focus` steers the crop, in `viewBox` units. `[x, y, w, h]` is the region that must stay visible: the window is the smallest one of the box's shape that contains it, so a small focus zooms in and a large one zooms out. `[x, y]` is a point: the drawing covers the box and the point stays as central as the drawing's edges allow. Absent means the whole drawing. An explicit `height` is what makes cropping happen at all — without one the rows follow the drawing's shape and nothing needs cropping.

Shapes carry one geometry key each: `path` (SVG path data), `points` (a polyline; `close: true` makes it a polygon), `line` `[x1, y1, x2, y2]`, `rect` `[x, y, w, h]`, `circle` `[cx, cy, r]`, or `text` with `at: [x, y]` (`anchor` start|middle|end, `bold`, `size` in terminal rows — default 1, so labels stay text-sized at every zoom, and they get a background halo so they read over linework). Every shape takes `stroke` and `fill` — a palette name, `bg`, or `none`; strokes default to `amber`, fills to `none` — plus `strokeWidth` in pixels (default 1.5; strokes keep their width at every zoom, like glyph stems), `dash`, and `dim`.

Shapes are data, not markup: the renderer emits a fixed vocabulary of SVG elements with validated numbers, escaped strings and path data limited to the path-command alphabet, so no element, attribute, script or URL can pass through. `alt` names the drawing for assistive tech and SEO. `link` as for `image`. Renders identically through SSR (with the 0.5 cell-ratio guess the client corrects on load).

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
- Layout invariant: every rendered line is exactly the client's column count in visible characters; alignment and chrome are literal characters, so copied text pastes like real terminal output. Nothing scrolls horizontally: `text` word-wraps, `code` continues over-wide lines on the next row (§2), and no widget truncates content.
- Character widths are counted one cell per character (ASCII + box drawing). Emoji/CJK are not width-aware in v1.

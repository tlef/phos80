// bbcode.js — whitelist inline markup parser: string → Segment[]
//
// Segments are the atom of styled text everywhere in the pipeline:
//   { text: string, style: {color?, bold?, dim?, underline?, inverse?, blink?}, href? }
//
// Supported tags (whitelist — anything else passes through as literal text):
//   [red]…[/red] etc. (16 ANSI-ish color names + amber)
//   [b] [dim] [u] [inv] [blink]
//   [link=target]label[/link]   target: /path, https://…, or a command word
//
// The parser NEVER emits HTML. render.js escapes every character, so API
// text has no injection path even in principle.

export const COLORS = [
  'amber', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brblack', 'brred', 'brgreen', 'bryellow', 'brblue', 'brmagenta', 'brcyan', 'brwhite',
];
const COLOR_SET = new Set(COLORS);

const FLAG_TAGS = {
  b: 'bold',
  dim: 'dim',
  u: 'underline',
  inv: 'inverse',
  inverse: 'inverse',
  blink: 'blink',
};

const TAG_RE = /\[(\/?)([a-z]+)(?:=([^\]]*))?\]/gi;

export function parse(text) {
  const segs = [];
  // Stack of open tags: { tag, style, href }
  const stack = [];
  let style = {};
  let href;
  let last = 0;

  const emit = (t) => {
    if (!t) return;
    const s = { text: t, style };
    if (href != null) s.href = href;
    segs.push(s);
  };

  const src = String(text ?? '');
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(src))) {
    const [raw, close, nameRaw, arg] = m;
    const name = nameRaw.toLowerCase();
    const known = COLOR_SET.has(name) || FLAG_TAGS[name] || name === 'link';
    if (!known) continue; // unknown tag → stays literal in the text flow

    emit(src.slice(last, m.index));
    last = m.index + raw.length;

    if (!close) {
      stack.push({ tag: name, style, href });
      if (name === 'link') {
        href = arg ?? '';
      } else if (COLOR_SET.has(name)) {
        style = { ...style, color: name };
      } else {
        style = { ...style, [FLAG_TAGS[name]]: true };
      }
    } else {
      // Find the matching open tag (tolerates sloppy nesting); if none, the
      // closing tag is treated as literal text.
      let idx = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === name) { idx = i; break; }
      }
      if (idx === -1) {
        last = m.index; // re-emit the raw tag as text on the next emit
        continue;
      }
      ({ style, href } = stack[idx]);
      stack.length = idx;
    }
  }
  emit(src.slice(last));
  return segs;
}

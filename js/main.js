// main.js — terminal shell: boot/hydration, input line, command dispatcher,
// scroll/page modes, resize reflow.
//
// All retained state is DOCUMENT MODELS (never rendered strings); any change
// in column count re-runs layout+render over the models. That is the whole
// responsive story.

import { layoutDoc, seg, wrapSegs, padSegs } from './layout.js';
import { renderLines } from './render.js';
import { measureChar, computeCols, debounce } from './metrics.js';
import { typeIn } from './typewriter.js';
import * as api from './api.mock.js';
import { WELCOME_DOC } from './welcome.js';

const crt = document.getElementById('crt');
const term = document.getElementById('term');
const headerEl = document.getElementById('header');
const screen = document.getElementById('screen');
const form = document.getElementById('prompt');
const input = document.getElementById('cmd');
const srLive = document.getElementById('sr-live');
const badge = document.getElementById('colsbadge');

const MAX_SCROLLBACK = 1000;
const TYPE_CPS = 10000; // typewriter reveal speed, characters per second
const MAX_COLS = 80; // viewport width cap, in character cells (terminal stays centered)

// Static header shown above the screen in page mode. Just another document
// model — same widgets, same pipeline, reflows with the viewport. An API
// response can install its own via a `header` field on the doc (see
// presentDoc); `header: null` restores this default.
const HEADER_DOC = {
  widgets: [
    {
      type: 'columns',
      min: 12,
      children: [
        { type: 'text', content: '[bryellow][b]▓▒░ PROJECT 80s[/b][/bryellow]' },
        { type: 'text', align: 'right', content: '[dim]sys[/dim] [green]OK[/green] · [cyan]ttyS0[/cyan]' },
      ],
    },
    { type: 'rule', char: '═' },
  ],
};

const state = {
  mode: 'scroll', // 'scroll' | 'page'
  scrollback: [], // { kind: 'echo', text } | { kind: 'doc', doc }
  page: null, // current doc in page mode
  header: HEADER_DOC, // header doc shown in page mode (API-replaceable)
  cols: 80,
  charW: 8,
  history: [],
  hIdx: 0,
  busy: false,
};

// ---------------------------------------------------------------------------
// Measurement / reflow
// ---------------------------------------------------------------------------

function remeasure() {
  const { charW, lineH } = measureChar(term);
  const cs = getComputedStyle(crt);
  const avail =
    crt.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const cols = computeCols(avail, charW, MAX_COLS);
  const changed = cols !== state.cols || charW !== state.charW;
  state.cols = cols;
  state.charW = charW;
  // Size the column to a whole number of cells so fractional char widths
  // can't wrap or clip the last column.
  term.style.width = `${(cols * charW).toFixed(2)}px`;

  // The header renders at the new width BEFORE the row snap so its real
  // height (which varies with cols) is subtracted from the screen's share.
  renderHeader();

  // Snap the screen to a whole number of ROWS too, so a scrolled view never
  // shows a half-cut line at the top (real terminals do exactly this).
  const availH =
    crt.clientHeight -
    parseFloat(cs.paddingTop) -
    parseFloat(cs.paddingBottom) -
    headerEl.offsetHeight -
    form.offsetHeight;
  const rows = Math.max(4, Math.floor(availH / lineH));
  screen.style.flex = '0 0 auto';
  screen.style.height = `${(rows * lineH).toFixed(2)}px`;

  badge.textContent = `${cols} COLS`;
  return changed;
}

// ---------------------------------------------------------------------------
// Rendering (always from retained models)
// ---------------------------------------------------------------------------

const blockHTML = (doc) =>
  `<div class="block">${renderLines(layoutDoc(doc, state.cols))}</div>`;

function echoHTML(text) {
  const segs = [seg('> ', { dim: true }), seg(text, { color: 'brwhite' })];
  const lines = wrapSegs(segs, state.cols).map((l) => padSegs(l, state.cols));
  return `<div class="block echo">${renderLines(lines)}</div>`;
}

const entryHTML = (e) => (e.kind === 'echo' ? echoHTML(e.text) : blockHTML(e.doc));

/** Header strip: page mode only, no typewriter, no .block margin. */
function renderHeader() {
  headerEl.innerHTML =
    state.mode === 'page' && state.header
      ? renderLines(layoutDoc(state.header, state.cols))
      : '';
}

function renderAll() {
  screen.innerHTML =
    state.mode === 'page'
      ? state.page
        ? blockHTML(state.page)
        : ''
      : state.scrollback.map(entryHTML).join('');
  scrollBottom();
}

function scrollBottom() {
  screen.scrollTop = screen.scrollHeight;
}

/** Append/replace with typewriter reveal; returns when fully revealed. */
function presentDoc(doc) {
  // A response may install its own header (`header: {…}`), restore the
  // default (`header: null`), or leave the current one alone (key absent).
  if ('header' in doc) {
    state.header = doc.header ?? HEADER_DOC;
    remeasure(); // header height changed → re-render it and re-snap rows
  }
  if (state.mode === 'page') {
    state.page = doc;
    screen.innerHTML = blockHTML(doc);
    return typeIn(screen.firstElementChild, { srLive, cps: TYPE_CPS });
  }
  state.scrollback.push({ kind: 'doc', doc });
  trimScrollback();
  screen.insertAdjacentHTML('beforeend', blockHTML(doc));
  return typeIn(screen.lastElementChild, { srLive, cps: TYPE_CPS, onTick: scrollBottom });
}

function appendEcho(text) {
  state.scrollback.push({ kind: 'echo', text });
  trimScrollback();
  screen.insertAdjacentHTML('beforeend', echoHTML(text));
  scrollBottom();
}

function trimScrollback() {
  const extra = state.scrollback.length - MAX_SCROLLBACK;
  if (extra > 0) {
    state.scrollback.splice(0, extra);
    for (let i = 0; i < extra && screen.firstElementChild; i++) {
      screen.firstElementChild.remove();
    }
  }
}

// ---------------------------------------------------------------------------
// Command dispatch — the single seam to a real API
// ---------------------------------------------------------------------------

function notice(text) {
  return { widgets: [{ type: 'frame', children: [{ type: 'text', content: text }] }] };
}

function setMode(m) {
  if (m !== 'scroll' && m !== 'page') {
    return {
      widgets: [
        {
          type: 'frame',
          color: 'red',
          title: 'ERROR',
          children: [{ type: 'text', content: '[red]usage:[/red] mode [green]scroll[/green]|[green]page[/green]' }],
        },
      ],
    };
  }
  state.mode = m;
  if (m === 'page') state.page = null;
  remeasure(); // header appears/disappears with the mode → re-snap rows
  renderAll(); // rebuild the screen from the new mode's retained models
  return notice(
    m === 'page'
      ? 'Display mode: [green][b]page[/b][/green] — each response replaces the screen, BBS style. [dim]Return with[/dim] [link=mode scroll]mode scroll[/link][dim].[/dim]'
      : 'Display mode: [green][b]scroll[/b][/green] — responses append to the scrollback.'
  );
}

async function dispatch(raw) {
  const cmd = raw.trim();
  if (!cmd || state.busy) return;
  state.history.push(cmd);
  state.hIdx = state.history.length;

  const [verb, ...args] = cmd.toLowerCase().split(/\s+/);

  // Client-handled commands
  if (verb === 'clear') {
    state.scrollback = [];
    state.page = null;
    renderAll();
    return;
  }
  if (state.mode === 'scroll') appendEcho(cmd);
  if (verb === 'mode') {
    await presentDoc(setMode(args[0]));
    return;
  }

  // Everything else goes to the "server"
  setBusy(true);
  try {
    const res = await api.execute(cmd);
    await presentDoc(res.doc);
  } catch (err) {
    await presentDoc({
      widgets: [
        {
          type: 'frame',
          color: 'red',
          title: 'ERROR',
          children: [{ type: 'text', content: `[red]transport failure:[/red] ${err.message ?? err}` }],
        },
      ],
    });
  } finally {
    setBusy(false);
  }
}

function setBusy(b) {
  state.busy = b;
  form.classList.toggle('busy', b);
  if (!b && matchMedia('(pointer: fine)').matches) input.focus();
}

// ---------------------------------------------------------------------------
// Input line
// ---------------------------------------------------------------------------

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = input.value;
  input.value = '';
  dispatch(value);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') {
    if (state.hIdx > 0) input.value = state.history[--state.hIdx] ?? '';
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (state.hIdx < state.history.length) input.value = state.history[++state.hIdx] ?? '';
    e.preventDefault();
  }
});

// Delegated interactivity: one listener covers every button/link ever
// rendered — including the static SSR content, which is what makes
// "hydration" instant.
document.addEventListener('click', (e) => {
  const cmdEl = e.target.closest?.('[data-cmd]');
  if (cmdEl) {
    e.preventDefault();
    dispatch(cmdEl.dataset.cmd);
    return;
  }
  // Clicking empty screen space focuses the prompt (but never steal a text
  // selection or a real link click).
  if (
    screen.contains(e.target) &&
    !e.target.closest('a, button') &&
    getSelection().isCollapsed
  ) {
    input.focus({ preventScroll: true });
  }
});

// ---------------------------------------------------------------------------
// Boot / hydration
// ---------------------------------------------------------------------------

async function boot() {
  try {
    await document.fonts.ready;
  } catch {
    /* older browsers: measure with whatever is loaded */
  }

  // Take over from the static SSR markup: same doc, now at the real width.
  remeasure();
  state.scrollback = [{ kind: 'doc', doc: WELCOME_DOC }];
  renderAll();

  const ro = new ResizeObserver(
    debounce(() => {
      if (remeasure()) renderAll();
    }, 150)
  );
  ro.observe(crt);

  if (matchMedia('(pointer: fine)').matches) input.focus();
}

boot();

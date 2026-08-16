// phos80/client.js — createTerminal(): the client-side terminal shell.
//
// FRAMEWORK ONLY — this file contains no site content. Every screen the
// visitor sees comes from the site: via `transport` (command → envelope),
// `initialDoc`, and the `chrome` config. See USAGE.md and PROTOCOL.md.
//
// All retained state is DOCUMENT MODELS (never rendered strings); any change
// in column count re-runs layout+render over the models. That is the whole
// responsive story.

import { layoutDoc, seg, wrapSegs, padSegs } from './core/layout.js';
import { renderLines } from './core/render.js';
import { measureChar, computeCols, debounce } from './core/metrics.js';
import { typeIn } from './core/typewriter.js';
import { themeVars } from './themes.js';

const DEFAULT_SETTINGS = {
  maxCols: 80, // viewport width cap, in character cells (terminal stays centered)
  minCols: 20,
  typeCps: 1000, // typewriter reveal speed, characters per second; 0 = instant
  maxScrollback: 1000,
  mode: 'scroll', // 'scroll' | 'page'
  scrolling: 'document', // 'document' (page grows, browser scrolls) | 'viewport' (fixed screen, inner scroll)
  borderSet: 'unicode', // 'unicode' | 'ascii' — charset for frames/rules
  autoFocus: true, // focus the prompt on load / after commands (fine-pointer devices only)
  focusOnClick: true, // clicking empty screen space focuses the prompt
  echo: true, // echo commands into the scrollback (scroll mode)
  historyKey: null, // localStorage key suffix to persist command history across visits
  externalLinks: '_blank', // target for http(s) links: '_blank' | '_self'
};

const HISTORY_MAX = 100;

// Neutral shell chrome. A framework may ship minimal status/error phrasing;
// it may not ship content — welcome screens, help text etc. belong to the site.
const DEFAULT_CHROME = {
  prompt: '>',
  placeholder: '',
  inputLabel: 'command input',
  header: null, // default page-mode header doc (site-supplied)
  colsBadge: true,
  notices: {
    modeScroll: 'display mode: [green][b]scroll[/b][/green]',
    modePage: 'display mode: [green][b]page[/b][/green]',
    modeUsage: '[red]usage:[/red] mode [green]scroll[/green]|[green]page[/green]',
  },
  errors: {
    transport: (err) => noticeDoc(`[red]transport failure:[/red] ${err?.message ?? err}`, 'red'),
  },
};

/** Wrap a BBCode string in a one-frame doc; pass docs through untouched. */
function noticeDoc(value, color) {
  if (value && typeof value === 'object') return value;
  return {
    widgets: [
      { type: 'frame', ...(color ? { color } : {}), children: [{ type: 'text', content: String(value) }] },
    ],
  };
}

const SKELETON = `
<div class="p80-crt" data-p80="crt">
  <div class="p80-term" data-p80="term">
    <div class="p80-header" data-p80="header"></div>
    <main class="p80-screen" data-p80="screen"></main>
    <form class="p80-prompt" data-p80="prompt" autocomplete="off">
      <span class="p80-ps1" data-p80="ps1" aria-hidden="true"></span>
      <input class="p80-cmd" data-p80="cmd" type="text" spellcheck="false" autocapitalize="off">
    </form>
  </div>
  <div class="p80-overlay" data-p80="overlay" aria-hidden="true"></div>
  <div class="p80-colsbadge" data-p80="colsbadge" aria-hidden="true"></div>
  <div class="p80-sronly" data-p80="srlive" role="status" aria-live="polite"></div>
</div>`;

/**
 * Mount a terminal.
 *
 * @param {object} config
 * @param {HTMLElement} config.mount     Host element. If it already contains a
 *   [data-p80="crt"] skeleton (server-prerendered), it is adopted in place;
 *   otherwise the skeleton is built.
 * @param {(cmd: string) => Promise<object>} config.transport  The site's API:
 *   command string in, envelope { ok, doc, header? } out.
 * @param {object} [config.initialDoc]   First screen (usually the same doc the
 *   server prerendered).
 * @param {object} [config.settings]     See DEFAULT_SETTINGS.
 * @param {object} [config.chrome]       See DEFAULT_CHROME.
 * @param {object} [config.commands]     Client-side commands. `clear: true` and
 *   `mode: true` enable the built-ins (default on); a function value
 *   `(args, term) => doc|string|null|Promise` adds a local command.
 * @param {string|object} [config.theme] Palette preset name ('amber' | 'green'
 *   | 'white' | 'ice') or { preset, colors, effects } — see themes.js. When
 *   omitted, the stylesheet defaults (and any site CSS overrides) apply.
 */
export function createTerminal({
  mount,
  transport,
  initialDoc = null,
  settings = {},
  chrome = {},
  commands = {},
  theme,
} = {}) {
  if (!mount) throw new Error('phos80: config.mount is required');
  if (typeof transport !== 'function') throw new Error('phos80: config.transport is required');

  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const chr = {
    ...DEFAULT_CHROME,
    ...chrome,
    notices: { ...DEFAULT_CHROME.notices, ...chrome.notices },
    errors: { ...DEFAULT_CHROME.errors, ...chrome.errors },
  };
  const cmds = { clear: true, mode: true, ...commands };

  // --- DOM: build or adopt ------------------------------------------------
  mount.classList.add('p80');
  if (!mount.querySelector('[data-p80="crt"]')) {
    mount.insertAdjacentHTML('beforeend', SKELETON);
  }
  const $ = (name) => mount.querySelector(`[data-p80="${name}"]`);
  const crt = $('crt');
  const term = $('term');
  const headerEl = $('header');
  const screen = $('screen');
  const form = $('prompt');
  const ps1 = $('ps1');
  const input = $('cmd');
  const badge = $('colsbadge');
  const srLive = $('srlive');

  ps1.textContent = chr.prompt;
  input.placeholder = chr.placeholder;
  input.setAttribute('aria-label', chr.inputLabel);
  if (!chr.colsBadge) badge.remove();

  // --- Theme -----------------------------------------------------------------
  // Applied as inline --p80-* properties on the mount, so it wins over site
  // CSS. When no theme is configured, nothing is set and the stylesheet
  // defaults (and any site CSS variable overrides) stay in charge.

  const appliedVars = [];

  function applyTheme(t) {
    for (const prop of appliedVars) mount.style.removeProperty(prop);
    appliedVars.length = 0;
    mount.classList.remove('p80-fx-noglow', 'p80-fx-noflicker');
    if (t == null) return;

    const setVar = (prop, value) => {
      mount.style.setProperty(prop, String(value));
      appliedVars.push(prop);
    };
    for (const [prop, value] of Object.entries(themeVars(t))) setVar(prop, value);

    // Effects: false → off, true/undefined → full, number → 0..1 intensity.
    const fx = (typeof t === 'object' && t.effects) || {};
    const level = (v) => (v === false ? 0 : v === true || v == null ? 1 : v);
    if (fx.scanlines !== undefined) setVar('--p80-scanlines', level(fx.scanlines));
    if (fx.vignette !== undefined) setVar('--p80-vignette', level(fx.vignette));
    if (fx.glow === false) mount.classList.add('p80-fx-noglow');
    else if (fx.glow !== undefined) setVar('--p80-glow', level(fx.glow));
    if (fx.flicker === false) mount.classList.add('p80-fx-noflicker');
  }

  applyTheme(theme);

  const historyStore = cfg.historyKey ? `p80:history:${cfg.historyKey}` : null;

  function loadHistory() {
    if (!historyStore) return [];
    try {
      const saved = JSON.parse(localStorage.getItem(historyStore) ?? '[]');
      return Array.isArray(saved) ? saved.slice(-HISTORY_MAX) : [];
    } catch {
      return []; // storage unavailable (privacy mode etc.)
    }
  }

  function saveHistory() {
    if (!historyStore) return;
    try {
      localStorage.setItem(historyStore, JSON.stringify(state.history.slice(-HISTORY_MAX)));
    } catch {
      /* best-effort */
    }
  }

  const state = {
    mode: cfg.mode,
    scrollback: [], // { kind: 'echo', text } | { kind: 'doc', doc }
    page: null, // current doc in page mode
    header: chr.header, // header doc shown in page mode (API-replaceable)
    cols: cfg.maxCols,
    charW: 8,
    history: loadHistory(),
    hIdx: 0,
    busy: false,
  };
  state.hIdx = state.history.length;

  const ac = new AbortController(); // detaches every listener on destroy()
  const signal = ac.signal;

  // --- Measurement / reflow -----------------------------------------------

  // Document-flow scrolling applies in scroll mode only; BBS page mode always
  // uses the fixed viewport (a "screen" that gets replaced, sticky header).
  const isFlow = () => cfg.scrolling === 'document' && state.mode === 'scroll';

  function syncFlow() {
    const flow = isFlow();
    mount.classList.toggle('p80-flow', flow);
    if (flow) {
      screen.style.flex = '';
      screen.style.height = '';
    }
  }

  function remeasure() {
    const { charW, lineH } = measureChar(term);
    const cs = getComputedStyle(crt);
    // Space the vertical scrollbar occupies inside the screen (0 for overlay
    // scrollbars; ~15px for classic ones, held constant by the CSS
    // scrollbar-gutter reservation). Columns must fit BESIDE it, or its
    // appearance would force a horizontal scrollbar.
    const gutter = screen.offsetWidth - screen.clientWidth;
    const avail =
      crt.clientWidth -
      parseFloat(cs.paddingLeft) -
      parseFloat(cs.paddingRight) -
      gutter;
    const cols = computeCols(avail, charW, cfg.maxCols, cfg.minCols);
    const changed = cols !== state.cols || charW !== state.charW;
    state.cols = cols;
    state.charW = charW;
    // Size the column to a whole number of cells (plus the scrollbar gutter)
    // so fractional char widths can't wrap or clip the last column.
    term.style.width = `${(cols * charW + gutter).toFixed(2)}px`;

    // The header renders at the new width BEFORE the row snap so its real
    // height (which varies with cols) is subtracted from the screen's share.
    renderHeader();

    // Viewport mode: snap the screen to a whole number of ROWS too, so a
    // scrolled view never shows a half-cut line at the top (real terminals do
    // exactly this). Document mode has no inner scroll — the page just grows.
    if (!isFlow()) {
      const availH =
        crt.clientHeight -
        parseFloat(cs.paddingTop) -
        parseFloat(cs.paddingBottom) -
        headerEl.offsetHeight -
        form.offsetHeight;
      const rows = Math.max(4, Math.floor(availH / lineH));
      screen.style.flex = '0 0 auto';
      screen.style.height = `${(rows * lineH).toFixed(2)}px`;
    }

    if (badge.isConnected) badge.textContent = `${cols} COLS`;
    return changed;
  }

  // --- Rendering (always from retained models) ----------------------------

  // Read cfg at call time so configure() changes take effect immediately.
  const layoutOpts = () => ({ borders: cfg.borderSet });
  const renderOpts = () => ({ externalLinks: cfg.externalLinks });

  const blockHTML = (doc) =>
    `<div class="p80-block">${renderLines(layoutDoc(doc, state.cols, layoutOpts()), renderOpts())}</div>`;

  function echoHTML(text) {
    const segs = [seg(`${chr.prompt} `, { dim: true }), seg(text, { color: 'brwhite' })];
    const lines = wrapSegs(segs, state.cols).map((l) => padSegs(l, state.cols));
    return `<div class="p80-block p80-echo">${renderLines(lines, renderOpts())}</div>`;
  }

  const entryHTML = (e) => (e.kind === 'echo' ? echoHTML(e.text) : blockHTML(e.doc));

  /** Header strip: page mode only, no typewriter, no block margin. */
  function renderHeader() {
    headerEl.innerHTML =
      state.mode === 'page' && state.header
        ? renderLines(layoutDoc(state.header, state.cols, layoutOpts()), renderOpts())
        : '';
  }

  function renderAll() {
    screen.innerHTML =
      state.mode === 'page'
        ? state.page
          ? blockHTML(state.page)
          : ''
        : state.scrollback.map(entryHTML).join('');
    // Document mode: don't yank the page on boot/resize re-renders — the
    // reader may be partway up the scrollback.
    if (!isFlow()) scrollBottom();
  }

  function scrollBottom() {
    if (isFlow()) {
      // The browser owns the scroll; keep the prompt in view with minimal movement.
      form.scrollIntoView({ block: 'nearest' });
      return;
    }
    screen.scrollTop = screen.scrollHeight;
  }

  function setHeader(doc) {
    state.header = doc ?? chr.header;
    remeasure(); // header height changed → re-render it and re-snap rows
  }

  /** Append/replace with typewriter reveal; returns when fully revealed. */
  function presentDoc(doc) {
    // A doc may install its own header (`header: {…}`), restore the site
    // default (`header: null`), or leave the current one alone (key absent).
    if (doc && 'header' in doc) setHeader(doc.header);
    if (state.mode === 'page') {
      state.page = doc;
      screen.innerHTML = blockHTML(doc);
      return typeIn(screen.firstElementChild, { srLive, cps: cfg.typeCps });
    }
    state.scrollback.push({ kind: 'doc', doc });
    trimScrollback();
    screen.insertAdjacentHTML('beforeend', blockHTML(doc));
    return typeIn(screen.lastElementChild, { srLive, cps: cfg.typeCps, onTick: scrollBottom });
  }

  function appendEcho(text) {
    state.scrollback.push({ kind: 'echo', text });
    trimScrollback();
    screen.insertAdjacentHTML('beforeend', echoHTML(text));
    scrollBottom();
  }

  function trimScrollback() {
    const extra = state.scrollback.length - cfg.maxScrollback;
    if (extra > 0) {
      state.scrollback.splice(0, extra);
      for (let i = 0; i < extra && screen.firstElementChild; i++) {
        screen.firstElementChild.remove();
      }
    }
  }

  // --- Command dispatch ----------------------------------------------------

  function clear() {
    state.scrollback = [];
    state.page = null;
    renderAll();
  }

  function setMode(m) {
    if (m !== 'scroll' && m !== 'page') {
      return noticeDoc(chr.notices.modeUsage, 'red');
    }
    state.mode = m;
    if (m === 'page') state.page = null;
    syncFlow(); // page mode always uses the fixed viewport
    remeasure(); // header appears/disappears with the mode → re-snap rows
    renderAll(); // rebuild the screen from the new mode's retained models
    return noticeDoc(m === 'page' ? chr.notices.modePage : chr.notices.modeScroll);
  }

  async function dispatch(raw) {
    const cmd = String(raw ?? '').trim();
    if (!cmd || state.busy) return;
    state.history.push(cmd);
    state.hIdx = state.history.length;
    saveHistory();

    const [verb, ...args] = cmd.toLowerCase().split(/\s+/);
    const local = cmds[verb];

    // Built-in client commands
    if (local === true && verb === 'clear') {
      clear();
      return;
    }
    if (cfg.echo && state.mode === 'scroll') appendEcho(cmd);
    if (local === true && verb === 'mode') {
      await presentDoc(setMode(args[0]));
      return;
    }
    // Site-supplied local commands
    if (typeof local === 'function') {
      const result = await local(args, api);
      if (result != null) await presentDoc(noticeDoc(result));
      return;
    }

    // Everything else goes to the site's API
    setBusy(true);
    try {
      const res = await transport(cmd);
      if (res && 'header' in res) setHeader(res.header);
      await presentDoc(res.doc);
    } catch (err) {
      await presentDoc(chr.errors.transport(err));
    } finally {
      setBusy(false);
    }
  }

  function setBusy(b) {
    state.busy = b;
    form.classList.toggle('p80-busy', b);
    if (!b && cfg.autoFocus && matchMedia('(pointer: fine)').matches) input.focus();
  }

  // --- Input line -----------------------------------------------------------

  form.addEventListener(
    'submit',
    (e) => {
      e.preventDefault();
      const value = input.value;
      input.value = '';
      dispatch(value);
    },
    { signal }
  );

  input.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'ArrowUp') {
        if (state.hIdx > 0) input.value = state.history[--state.hIdx] ?? '';
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (state.hIdx < state.history.length) input.value = state.history[++state.hIdx] ?? '';
        e.preventDefault();
      }
    },
    { signal }
  );

  // Delegated interactivity: one listener covers every button/link ever
  // rendered — including server-prerendered content, which is what makes
  // "hydration" instant.
  mount.addEventListener(
    'click',
    (e) => {
      const cmdEl = e.target.closest?.('[data-cmd]');
      if (cmdEl) {
        e.preventDefault();
        dispatch(cmdEl.dataset.cmd);
        return;
      }
      // Clicking empty screen space focuses the prompt (but never steal a
      // text selection or a real link click).
      if (
        cfg.focusOnClick &&
        screen.contains(e.target) &&
        !e.target.closest('a, button') &&
        getSelection().isCollapsed
      ) {
        input.focus({ preventScroll: true });
      }
    },
    { signal }
  );

  // --- Boot / hydration -----------------------------------------------------

  const ro = new ResizeObserver(
    debounce(() => {
      if (remeasure()) renderAll();
    }, 150)
  );

  async function boot() {
    try {
      await document.fonts.ready;
    } catch {
      /* older browsers: measure with whatever is loaded */
    }
    if (signal.aborted) return;

    // Take over from any static prerendered markup: same doc, real width.
    syncFlow();
    remeasure();
    if (initialDoc) {
      if (state.mode === 'page') state.page = initialDoc;
      else state.scrollback = [{ kind: 'doc', doc: initialDoc }];
    }
    renderAll();
    ro.observe(crt);
    // Fallback for browsers without scrollbar-gutter: a classic scrollbar
    // appearing shrinks the screen's content box, which fires the observer
    // and re-runs the measurement with the new gutter width.
    ro.observe(screen);
    if (cfg.autoFocus && matchMedia('(pointer: fine)').matches) input.focus();
  }

  boot();

  // --- Public instance API --------------------------------------------------

  const api = {
    dispatch,
    print: (doc) => presentDoc(doc),
    setHeader,
    setMode: (m) => presentDoc(setMode(m)),
    clear,
    focus: () => input.focus(),
    setTheme: (t) => {
      applyTheme(t);
      // A theme may change the font → character metrics; re-check.
      if (remeasure()) renderAll();
    },
    /**
     * Update settings at runtime (typeCps, maxCols, borderSet, echo, …).
     * Use setMode() for the display mode. Re-lays-out if the grid changed.
     */
    configure: (partial = {}) => {
      Object.assign(cfg, partial);
      syncFlow();
      if (remeasure()) renderAll();
    },
    get settings() {
      return { ...cfg };
    },
    remeasure: () => {
      if (remeasure()) renderAll();
    },
    get mode() {
      return state.mode;
    },
    get cols() {
      return state.cols;
    },
    destroy: () => {
      ac.abort();
      ro.disconnect();
    },
  };
  return api;
}

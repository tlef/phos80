// demo/demo.js — the reference consumer of the phos80 framework.
//
// Everything a site must do lives in this file: mount, transport, content.
// It uses only the documented entry point (phos80/client.js); if the demo
// needs framework internals, the framework API is wrong.

import { createTerminal } from '../phos80/client.js';
import { THEMES } from '../phos80/themes.js';
import { execute } from './api.mock.js';
import { WELCOME_DOC, HEADER_DOC } from './content.js';

const THEME_NAMES = Object.keys(THEMES);

// The demo's theme/effects state. setTheme() applies a whole config, so
// local commands merge their changes here and reapply.
const themeState = { preset: 'amber', effects: { textFlicker: 0.7 } };

const EFFECT_NAMES = ['scanlines', 'glow', 'flicker', 'vignette', 'textFlicker'];

/** Command args arrive lowercased, so match effect names case-insensitively. */
const resolveEffect = (name) => EFFECT_NAMES.find((n) => n.toLowerCase() === name);

function applyThemeState(term) {
  term.setTheme({ preset: themeState.preset, effects: themeState.effects });
}

function fmtEffect(name) {
  const v = themeState.effects[name];
  if (v === false) return '[red]off[/red]';
  if (typeof v === 'number') return `[yellow]${v}[/yellow]`;
  return '[green]on[/green]';
}

createTerminal({
  mount: document.getElementById('terminal'),

  // The site's API seam. Here a mock with canned responses and fake latency;
  // a real site swaps this single function for a fetch to its backend.
  transport: execute,

  // Same doc the prerendered markup in index.html was generated from — on
  // load it re-renders at the visitor's true width and takes over.
  initialDoc: WELCOME_DOC,

  settings: {
    maxCols: 80,
    maxScrollback: 1000,
  },

  chrome: {
    placeholder: 'type help',
    header: HEADER_DOC,
  },

  // Text flicker is opt-in framework-side; the demo turns it on to show it off.
  theme: { preset: themeState.preset, effects: themeState.effects },

  commands: {
    // A site-supplied local command: switches the phosphor at runtime.
    theme: (args, term) => {
      const name = args[0];
      if (!THEME_NAMES.includes(name)) {
        return (
          `[red]usage:[/red] theme ` +
          THEME_NAMES.map((n) => `[green]${n}[/green]`).join('|')
        );
      }
      themeState.preset = name;
      applyThemeState(term);
      return `phosphor set to [b]${name}[/b]`;
    },

    // CRT effect toggles: `effects scanlines off`, `effects glow 0.5`, …
    // `effects` alone shows the current state.
    effects: (args, term) => {
      const [name, value] = args;
      if (!name) {
        return {
          widgets: [
            {
              type: 'frame',
              title: 'EFFECTS',
              children: EFFECT_NAMES.map((n) => ({
                type: 'text',
                content: `[brwhite][b]${n}[/b][/brwhite]${' '.repeat(Math.max(1, 12 - n.length))}${fmtEffect(n)}`,
              })).concat([
                { type: 'spacer' },
                { type: 'text', content: '[dim]usage:[/dim] effects [green]<name>[/green] [green]on[/green]|[green]off[/green]|[green]0..2[/green] [dim](1 = default, 2 = double)[/dim]' },
              ]),
            },
          ],
        };
      }
      const key = resolveEffect(name);
      if (!key) {
        return `[red]unknown effect:[/red] ${name} [dim]— try[/dim] ${EFFECT_NAMES.map((n) => `[green]${n}[/green]`).join(', ')}`;
      }
      const num = Number(value);
      let level;
      if (value === 'on') level = true;
      else if (value === 'off') level = false;
      // 1 = the effect's default strength; above 1 amplifies it.
      else if (!Number.isNaN(num) && value !== undefined) level = Math.max(0, Math.min(2, num));
      else return `[red]usage:[/red] effects ${key} [green]on[/green]|[green]off[/green]|[green]0..2[/green]`;
      themeState.effects[key] = level;
      applyThemeState(term);
      return `${key} ${fmtEffect(key)}`;
    },

    // Typewriter speed: `speed 2000`, `speed off` (instant), `speed default`.
    speed: (args, term) => {
      const v = args[0];
      if (!v) {
        const cps = term.settings.typeCps;
        return `typewriter: ${cps <= 0 ? '[red]off[/red]' : `[yellow]${cps}[/yellow] cps`} [dim]— usage: speed[/dim] [green]<cps>[/green]|[green]off[/green]|[green]default[/green]`;
      }
      let cps;
      if (v === 'off' || v === 'instant') cps = 0;
      else if (v === 'default') cps = 1000;
      else if (!Number.isNaN(Number(v))) cps = Math.max(0, Number(v));
      else return '[red]usage:[/red] speed [green]<cps>[/green]|[green]off[/green]|[green]default[/green]';
      term.configure({ typeCps: cps });
      return `typewriter ${cps <= 0 ? '[red]off[/red] — instant paint' : `set to [yellow]${cps}[/yellow] cps`}`;
    },
  },
});

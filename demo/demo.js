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
    typeCps: 10000,
    maxScrollback: 1000,
  },

  chrome: {
    placeholder: 'type help',
    header: HEADER_DOC,
  },

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
      term.setTheme(name);
      return `phosphor set to [b]${name}[/b]`;
    },
  },
});

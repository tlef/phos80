// demo/demo.js — the reference consumer of the Phosphor framework.
//
// Everything a site must do lives in this file: mount, transport, content.
// It uses only the documented entry point (phosphor/client.js); if the demo
// needs framework internals, the framework API is wrong.

import { createTerminal } from '../phosphor/client.js';
import { execute } from './api.mock.js';
import { WELCOME_DOC, HEADER_DOC } from './content.js';

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
});

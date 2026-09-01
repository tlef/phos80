// api.mock.js — fake server. execute(cmd) → Promise<{ ok, doc }>
//
// This is the single seam to replace with a real backend later:
//   execute = (cmd) => fetch('/api/command', …).then(r => r.json())
// Responses are Docs: { widgets: [...] } with BBCode-ish inline markup in
// text content (see bbcode.js for the tag whitelist).

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const PALETTE_ROW_1 = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
const PALETTE_ROW_2 = ['brblack', 'brred', 'brgreen', 'bryellow', 'brblue', 'brmagenta', 'brcyan', 'brwhite'];
const bar = (names) => names.map((c) => `[${c}]██[/${c}]`).join(' ');

const NEWS = [
  {
    headline: 'TERMINAL BOOTS FOR FIRST TIME',
    byline: 'wire report · 2026-08-11',
    body:
      'Local machine reports successful power-on self test. Phosphor warm-up ' +
      'nominal. Engineers celebrated by typing [green]help[/green] repeatedly ' +
      'and watching the frames redraw themselves at every window size.',
  },
  {
    headline: 'PADDING SPACES DECLARED LOAD-BEARING',
    byline: 'layout desk · 2026-08-11',
    body:
      'In a surprise ruling, right-justified text was found to contain ' +
      '[b]actual spaces[/b], recomputed on every resize. "Try selecting and ' +
      'copying the screen," said one insider. "It pastes like a real ' +
      'terminal, because it is one."',
  },
  {
    headline: 'BBCODE PARSER REFUSES TO RENDER HTML',
    byline: 'security desk · 2026-08-11',
    body:
      'Markup like <script>alert("nope")</script> & friends arrive as plain ' +
      'text and stay that way. Only whitelisted tags such as [cyan]colors[/cyan], ' +
      '[b]bold[/b] and [link=https://en.wikipedia.org/wiki/BBCode]links[/link] ' +
      'survive the trip.',
  },
];

const ABOUT_PANEL = {
  type: 'frame',
  border: 'double',
  title: 'ABOUT',
  children: [
    { type: 'text', align: 'center', content: '[bryellow][b]PHOS80[/b][/bryellow]' },
    { type: 'text', align: 'center', content: '[dim]a terminal-shaped website[/dim]' },
    { type: 'spacer' },
    {
      type: 'text',
      content:
        'Everything you see is laid out on a character grid: frames are box-drawing ' +
        'glyphs, alignment is literal padding spaces, and the whole screen re-flows ' +
        'from its document model whenever the viewport changes. Resize this window ' +
        'and watch the right edge follow you — and the panel beside this one drop ' +
        'below when the window gets too narrow for both.',
    },
    { type: 'spacer' },
    { type: 'rule' },
    { type: 'text', align: 'center', content: bar(PALETTE_ROW_1) },
    { type: 'text', align: 'center', content: bar(PALETTE_ROW_2) },
    { type: 'rule' },
    { type: 'spacer' },
    { type: 'text', align: 'right', content: '[dim]built[/dim] [cyan]2026-08-11[/cyan] [dim]· no frameworks were harmed[/dim]' },
  ],
};

const LOREM_PANEL = {
  type: 'frame',
  title: 'LOREM',
  children: [
    {
      type: 'text',
      content:
        '[dim]Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do ' +
        'eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad ' +
        'minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ' +
        'ex ea commodo consequat.[/dim]',
    },
    { type: 'spacer' },
    { type: 'text', align: 'right', content: '[dim]— side panel, est. 1983[/dim]' },
  ],
};

// A source listing with producer-supplied colouring. phos80 highlights
// nothing: the colour tags are part of the content, like any other text.
const COUNTER_JSX = [
  "[magenta]import[/magenta] { useState } [magenta]from[/magenta] [green]'react'[/green];",
  '',
  '[magenta]export function[/magenta] [brcyan]Counter[/brcyan]({ label }) {',
  '  [magenta]const[/magenta] [count, setCount] = useState([yellow]0[/yellow]);',
  '  [dim]// narrow the window: the return below continues, indented and marked[/dim]',
  '  [magenta]return[/magenta] <[cyan]button[/cyan] [brwhite]onClick[/brwhite]={() => setCount(count + [yellow]1[/yellow])}>{label}: {count}</[cyan]button[/cyan]>;',
  '}',
].join('\n');

const SHELL_SESSION = [
  '[green]$[/green] curl -s /api/cmd -d [yellow]\'{"cmd":"code"}\'[/yellow] | jq .doc.widgets[0].type',
  '[dim]"frame"[/dim]',
].join('\n');

const CANNED = {
  help: () => ({
    widgets: [
      {
        type: 'frame',
        title: 'COMMANDS',
        children: [
          // `row` pushes parts to the edges of one line — no hand-counted
          // padding, and the leaders redraw at every width.
          ...[
            ['[brwhite][b]help[/b][/brwhite]', 'this screen'],
            ['[brwhite][b]about[/b][/brwhite]', 'who is this machine'],
            ['[brwhite][b]news[/b][/brwhite] [dim]<n>[/dim]', 'read the wire, page by page'],
            ['[brwhite][b]mode[/b][/brwhite] [dim]<m>[/dim]', '[green]scroll[/green] or [green]page[/green] display'],
            ['[brwhite][b]theme[/b][/brwhite] [dim]<t>[/dim]', '[green]amber[/green] [green]green[/green] [green]white[/green] [green]ice[/green]'],
            ['[brwhite][b]effects[/b][/brwhite] [dim]…[/dim]', 'CRT effects, e.g. [green]scanlines 0.5[/green]'],
            ['[brwhite][b]speed[/b][/brwhite] [dim]<n>[/dim]', 'typewriter cps, [green]off[/green] or [green]default[/green]'],
            ['[brwhite][b]poster[/b][/brwhite] [dim]<t>[/dim]', 'inline image + treatments'],
            ['[brwhite][b]code[/b][/brwhite]', 'a source listing that never reflows'],
            ['[brwhite][b]borders[/b][/brwhite] [dim]<s>[/dim]', '[green]unicode[/green] or [green]ascii[/green] frames'],
            ['[brwhite][b]scrolling[/b][/brwhite] [dim]<s>[/dim]', '[green]document[/green] or [green]viewport[/green]'],
            ['[brwhite][b]clear[/b][/brwhite]', 'wipe the screen'],
          ].map(([cmd, desc]) => ({ type: 'row', parts: [cmd, desc], fill: '.' })),
          { type: 'spacer' },
          { type: 'text', content: '[dim]tip: words like[/dim] [link=about]about[/link] [dim]are links — click or tab to them.[/dim]' },
        ],
      },
      { type: 'text', align: 'right', content: '[dim]serial line ok · 9600 baud[/dim]' },
    ],
  }),

  about: () => ({
    widgets: [
      {
        // Two panels side by side; they stack when the viewport is too
        // narrow to give each column its `min` width — terminal flexbox.
        type: 'columns',
        widths: [3, 2],
        min: 34,
        children: [ABOUT_PANEL, LOREM_PANEL],
      },
      { type: 'buttons', align: 'center', items: [{ label: 'HELP' }, { label: 'NEWS', command: 'news 1' }] },
    ],
  }),

  poster: (args) => {
    const treatment = ['phosphor', 'pixel', 'plain'].includes(args[0]) ? args[0] : 'phosphor';
    return {
      widgets: [
        {
          type: 'frame',
          // Border colour and title colour are independent: `color` tints the
          // border, inline markup in `title` styles just the title.
          color: 'cyan',
          title: '[bryellow]TRAVEL BUREAU[/bryellow]',
          children: [
            {
              // An image inside a column: it reserves real grid rows, so the
              // text column beside it stays row-aligned and the frame draws
              // borders down both sides. Stacks below 30 cells per column.
              type: 'columns',
              widths: [2, 3],
              min: 30,
              gap: 3,
              children: [
                {
                  type: 'image',
                  src: 'poster.svg',
                  alt: 'Retro travel poster: a jungle moon beneath an orange gas giant',
                  aspect: 480 / 720, // reserves the right rows before it loads
                  treatment,
                  link: 'poster.svg',
                },
                {
                  type: 'frame',
                  children: [
                    { type: 'text', content: '[bryellow][b]VISIT BEAUTIFUL YAVIN 4[/b][/bryellow]' },
                    { type: 'text', content: '[dim]jungle moon of the gas giant Yavin[/dim]' },
                    { type: 'rule' },
                    { type: 'spacer' },
                    {
                      type: 'text',
                      content:
                        'Temperate rainforest, ancient stone temples, and a sky ' +
                        'filled from horizon to horizon by the gas giant itself.',
                      margin: [1, 1],
                    },
                    { type: 'spacer' },
                    { type: 'row', parts: ['GRAVITY', '[brwhite]0.9 g[/brwhite]'], fill: '.' },
                    { type: 'row', parts: ['DAY', '[brwhite]24 h[/brwhite]'], fill: '.' },
                    { type: 'row', parts: ['MOONS', '[brwhite]none[/brwhite]'], fill: '.' },
                    { type: 'spacer' },
                    {
                      type: 'text',
                      content: `[dim]treatment:[/dim] [green]${treatment}[/green]`,
                    },
                    { type: 'text', content: '[dim]click the poster for full size[/dim]' },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'buttons',
          align: 'center',
          items: [
            { label: 'PHOSPHOR', command: 'poster phosphor' },
            { label: 'PIXEL', command: 'poster pixel' },
            { label: 'PLAIN', command: 'poster plain' },
          ],
        },
      ],
    };
  },

  code: () => ({
    widgets: [
      {
        type: 'frame',
        title: '[brcyan]Counter.jsx[/brcyan]',
        children: [
          // `code` keeps every logical line whole: no soft-wrap at spaces,
          // indentation preserved. An over-wide line continues on the next
          // row with a dim ↪ (> under ASCII borders) so it can't be read as
          // a new statement. The gutter numbers logical lines, not rows.
          { type: 'code', gutter: true, content: COUNTER_JSX },
        ],
      },
      {
        type: 'text',
        margin: [2, 2],
        content:
          '[dim]The colours above arrived as BBCode tags in the content — the ' +
          'terminal highlights nothing itself. Resize the window and the long ' +
          'line breaks at the edge, not at a space, keeping its indent.[/dim]',
      },
      { type: 'spacer' },
      { type: 'code', content: SHELL_SESSION, margin: [2, 2] },
      { type: 'spacer' },
      {
        type: 'buttons',
        align: 'center',
        items: [
          { label: 'ASCII', command: 'borders ascii' },
          { label: 'UNICODE', command: 'borders unicode' },
          { label: 'HELP' },
        ],
      },
    ],
  }),

  news: (args) => {
    const n = Math.min(NEWS.length, Math.max(1, parseInt(args[0], 10) || 1));
    const a = NEWS[n - 1];
    const nav = [];
    if (n > 1) nav.push({ label: 'PREV', command: `news ${n - 1}` });
    if (n < NEWS.length) nav.push({ label: 'NEXT', command: `news ${n + 1}` });
    return {
      // In page mode this replaces the default masthead; it stays until
      // another response changes it (`header: null` restores the default).
      header: {
        widgets: [
          {
            type: 'columns',
            min: 12,
            children: [
              { type: 'text', content: '[bryellow][b]THE DAILY PHOSPHOR[/b][/bryellow]' },
              { type: 'text', align: 'right', content: `[dim]page[/dim] [brwhite]${n}/${NEWS.length}[/brwhite] · [link=help]help[/link]` },
            ],
          },
          { type: 'rule', char: '═' },
        ],
      },
      widgets: [
        {
          type: 'frame',
          title: `[brcyan]NEWS ${n}/${NEWS.length}[/brcyan]`,
          children: [
            { type: 'text', content: `[yellow][b]${a.headline}[/b][/yellow]` },
            { type: 'text', align: 'right', content: `[dim]${a.byline}[/dim]` },
            { type: 'rule' },
            { type: 'spacer' },
            { type: 'text', content: a.body, margin: [2, 2] },
            { type: 'spacer' },
          ],
        },
        { type: 'buttons', align: 'center', items: nav },
      ],
    };
  },
};

function errorDoc(cmd) {
  return {
    widgets: [
      {
        type: 'frame',
        color: 'red',
        title: '[b]ERROR[/b]', // titles are plain unless styled
        children: [
          { type: 'text', content: `[red]command not recognized:[/red] [brwhite]${cmd}[/brwhite]` },
          { type: 'text', content: '[dim]try[/dim] [link=help]help[/link]' },
        ],
      },
    ],
  };
}

export async function execute(cmd) {
  await delay(150 + Math.random() * 300);
  const [verb, ...args] = cmd.trim().toLowerCase().split(/\s+/);
  const handler = CANNED[verb];
  if (!handler) return { ok: false, doc: errorDoc(verb) };
  return { ok: true, doc: handler(args) };
}

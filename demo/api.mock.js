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

const CANNED = {
  help: () => ({
    widgets: [
      {
        type: 'frame',
        title: 'COMMANDS',
        children: [
          { type: 'text', content: '[brwhite][b]help[/b][/brwhite]          this screen' },
          { type: 'text', content: '[brwhite][b]about[/b][/brwhite]         who is this machine' },
          { type: 'text', content: '[brwhite][b]news[/b][/brwhite] [dim]<n>[/dim]      read the wire, page by page' },
          { type: 'text', content: '[brwhite][b]mode[/b][/brwhite] [dim]<m>[/dim]      display mode: [green]scroll[/green] or [green]page[/green]' },
          { type: 'text', content: '[brwhite][b]theme[/b][/brwhite] [dim]<t>[/dim]     phosphor: [green]amber[/green], [green]green[/green], [green]white[/green] or [green]ice[/green]' },
          { type: 'text', content: '[brwhite][b]effects[/b][/brwhite] [dim]…[/dim]    CRT effects, e.g. [green]effects scanlines off[/green]' },
          { type: 'text', content: '[brwhite][b]speed[/b][/brwhite] [dim]<n>[/dim]     typewriter cps, or [green]off[/green] / [green]default[/green]' },
          { type: 'text', content: '[brwhite][b]poster[/b][/brwhite] [dim]<t>[/dim]    inline image; treatments [green]phosphor[/green]|[green]pixel[/green]|[green]plain[/green]' },
          { type: 'text', content: '[brwhite][b]clear[/b][/brwhite]         wipe the screen' },
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
          title: 'TRAVEL BUREAU',
          children: [
            { type: 'text', align: 'center', content: '[bryellow][b]VISIT BEAUTIFUL YAVIN 4[/b][/bryellow]' },
            { type: 'text', align: 'center', content: '[dim]jungle moon of the gas giant Yavin[/dim]' },
            { type: 'spacer' },
            {
              type: 'image',
              src: 'poster.svg',
              alt: 'Retro travel poster: a jungle moon beneath an orange gas giant',
              width: 36,
              align: 'center',
              treatment,
              link: 'poster.svg',
            },
            { type: 'spacer' },
            {
              type: 'text',
              align: 'center',
              content: `[dim]treatment:[/dim] [green]${treatment}[/green] [dim]· click the poster for full size[/dim]`,
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
          title: `NEWS ${n}/${NEWS.length}`,
          children: [
            { type: 'text', content: `[yellow][b]${a.headline}[/b][/yellow]` },
            { type: 'text', align: 'right', content: `[dim]${a.byline}[/dim]` },
            { type: 'rule' },
            { type: 'text', content: a.body },
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
        title: 'ERROR',
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

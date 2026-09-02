// demo/map.js — the demo's example vector drawing: a survey chart of a
// fictional island, as `vector` widget data (see PROTOCOL.md § vector).
//
// SITE content, not framework code: a real backend would keep something
// like this in a database or a file and send it in a doc. Everything is
// plain JSON — shapes in a 1000×600 viewBox — so the terminal can recolour
// it from the theme and re-crop it around a focus at every width.

// Graticule: dim lines every 100 units, drawn first so land covers it.
const GRID = [];
for (let x = 100; x < 1000; x += 100) GRID.push({ line: [x, 0, x, 600], stroke: 'brblack', dim: true });
for (let y = 100; y < 600; y += 100) GRID.push({ line: [0, y, 1000, y], stroke: 'brblack', dim: true });

const COAST = [
  [180, 300], [200, 230], [250, 180], [300, 140], [400, 110], [520, 90], [640, 120],
  [760, 170], [820, 150], [870, 200], [850, 300], [850, 360], [790, 450], [690, 500],
  [560, 520], [520, 480], [470, 510], [430, 500], [320, 470], [230, 410], [190, 350],
];

const LAKE = [[380, 250], [430, 230], [460, 270], [420, 300], [370, 290]];

// A ridge: three peaks as open polylines.
const RANGE = [
  [[520, 330], [545, 290], [570, 330]],
  [[560, 320], [590, 270], [620, 320]],
  [[610, 330], [650, 280], [690, 330]],
];

const TOWNS = [
  { name: 'PHOSPHOR CITY', at: [470, 330], capital: true },
  { name: 'AMBERPORT', at: [250, 310] },
  { name: 'CATHODE', at: [700, 220] },
  { name: 'GRIDLEY', at: [600, 450] },
];

const town = (t) => [
  t.capital ? { circle: [...t.at, 11], stroke: 'bryellow' } : null,
  { circle: [...t.at, 5], fill: 'bryellow', stroke: 'none' },
  { text: t.name, at: [t.at[0] + 16, t.at[1]], color: 'brwhite', bold: Boolean(t.capital) },
].filter(Boolean);

export const ISLAND_CHART = {
  type: 'vector',
  viewBox: [0, 0, 1000, 600],
  alt: 'Survey chart of the Isle of Phos: four towns joined by rail, a central lake and a mountain ridge',
  shapes: [
    ...GRID,
    // Land is filled with the background so the graticule reads as sea.
    { points: COAST, close: true, fill: 'bg', strokeWidth: 2 },
    { points: LAKE, close: true, dim: true },
    ...RANGE.map((pts) => ({ points: pts, dim: true })),
    // Rail lines between the towns.
    { points: [[250, 310], [470, 330], [600, 450]], stroke: 'cyan', dash: true },
    { points: [[470, 330], [700, 220]], stroke: 'cyan', dash: true },
    // Sea lane off the west coast.
    { points: [[250, 310], [120, 340], [40, 420]], dash: true, dim: true },
    { text: 'TO MAINLAND', at: [40, 445], dim: true, size: 0.9 },
    ...TOWNS.flatMap(town),
    // Compass rose.
    { line: [920, 130, 920, 70] },
    { points: [[912, 78], [920, 58], [928, 78]], close: true, fill: 'amber' },
    { text: 'N', at: [920, 42], anchor: 'middle', bold: true },
    // Scale bar.
    { line: [700, 565, 900, 565], strokeWidth: 2 },
    { line: [700, 558, 700, 572] },
    { line: [900, 558, 900, 572] },
    { text: '200 KM', at: [800, 545], anchor: 'middle', dim: true, size: 0.9 },
    // Cartouche.
    { rect: [40, 495, 300, 75], fill: 'bg' },
    { text: 'ISLE OF PHOS', at: [60, 520], bold: true, size: 1.2 },
    { text: 'SURVEY CHART · 1983', at: [60, 550], dim: true, size: 0.9 },
  ],
};

// Where the `map <where>` command points the crop. A rect must stay visible
// (zooming in or out as needed); a point means "cover the box, keep me
// central".
export const CHART_FOCUS = {
  island: [30, 30, 920, 550],
  capital: [340, 200, 380, 180],
  port: [250, 310],
  north: [600, 100, 300, 180],
};

// Small SVG charts for the dashboard (hq #465).
//
// Drawn with createElementNS, never markup. One y-axis per chart, a legend whenever there
// are two series or more, a <title> on every mark, and a table of the same values beside
// each chart so no number lives only in a colour. The series colours are CSS variables the
// page declares per theme (`--ttc-chart-1` …), assigned in a fixed order, never cycled.

import { TOKENS } from '../data/tokens.js';
import { el } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const W = 320;
const H = 140;
const PAD = { top: 8, right: 8, bottom: 20, left: 8 };
/** The fixed order the series take their colours in: 1, 3, 4, 2. */
export const SERIES_ORDER = Object.freeze([1, 3, 4, 2]);

function svg(doc, tag, attrs = {}, ...children) {
  const node = doc.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, String(v));
  for (const child of children) if (child) node.append(child);
  return node;
}

const titled = (doc, node, words) => {
  node.append(svg(doc, 'title', {}, doc.createTextNode(words)));
  return node;
};

/** Short day label: '2026-11-02' → '2 Nov'. */
export function dayLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${d} ${month}`;
}

/** A compact number: 1234 → '1.2k', 2500000 → '2.5m'. */
export function compact(n) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  for (const [size, unit] of [[1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']]) {
    if (a >= size) return `${sign}${Math.round((a / size) * 10) / 10}${unit}`;
  }
  return `${sign}${Math.round(a)}`;
}

function legend(doc, series) {
  if (series.length < 2) return null;
  return el('ul', { class: 'ttc-legend', ownerDocument: doc }, ...series.map((s, i) => el('li', { ownerDocument: doc },
    el('span', { class: `ttc-swatch ttc-c${SERIES_ORDER[i]}`, 'aria-hidden': 'true', ownerDocument: doc }), s.label)));
}

/** The same values as a table, for screen readers and anyone who'd rather read numbers. */
export function valuesTable(doc, { caption, rows, series, format = compact }) {
  return el('details', { class: 'ttc-values', ownerDocument: doc },
    el('summary', { ownerDocument: doc }, 'Show the numbers'),
    el('table', { ownerDocument: doc },
      el('caption', { ownerDocument: doc }, caption),
      el('thead', { ownerDocument: doc }, el('tr', { ownerDocument: doc },
        el('th', { scope: 'col', ownerDocument: doc }, 'Day'),
        ...series.map((s) => el('th', { scope: 'col', ownerDocument: doc }, s.label)))),
      el('tbody', { ownerDocument: doc }, ...rows.map((r) => el('tr', { ownerDocument: doc },
        el('th', { scope: 'row', ownerDocument: doc }, dayLabel(r.date)),
        ...series.map((s) => el('td', { ownerDocument: doc }, r[s.key] == null ? '–' : format(r[s.key]))))))));
}

const frame = (doc, label) => svg(doc, 'svg', {
  viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, class: 'ttc-chart', preserveAspectRatio: 'none',
});

/**
 * Bars per day for up to four series side by side, from one zero line. Values below zero
 * hang under it.
 * @param {{rows: {date: string}[], series: {key: string, label: string}[], label: string}} opts
 */
export function barChart(doc, { rows, series, label, format = compact }) {
  const values = rows.flatMap((r) => series.map((s) => r[s.key])).filter((v) => typeof v === 'number');
  const top = Math.max(0, ...values);
  const bottom = Math.min(0, ...values);
  const span = top - bottom || 1;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v) => PAD.top + ((top - v) / span) * plotH;
  const slot = (W - PAD.left - PAD.right) / Math.max(rows.length, 1);
  const gap = 2;
  const barW = Math.max(2, (slot - 6 - gap * (series.length - 1)) / series.length);
  const chart = frame(doc, label);
  chart.append(svg(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: y(0), y2: y(0), class: 'ttc-axis' }));
  rows.forEach((r, i) => {
    const x0 = PAD.left + i * slot + 3;
    series.forEach((s, j) => {
      const v = r[s.key];
      if (typeof v !== 'number') return;
      const yTop = Math.min(y(v), y(0));
      const h = Math.max(1, Math.abs(y(v) - y(0)));
      chart.append(titled(doc, svg(doc, 'rect', {
        x: x0 + j * (barW + gap), y: yTop, width: barW, height: h, rx: Math.min(2, barW / 2),
        class: `ttc-mark ttc-c${SERIES_ORDER[j]}`,
      }), `${dayLabel(r.date)} · ${s.label}: ${format(v)}`));
    });
    if (rows.length <= 8 || i % Math.ceil(rows.length / 7) === 0) {
      chart.append(svg(doc, 'text', { x: x0 + (slot - 6) / 2, y: H - 6, class: 'ttc-tick', 'text-anchor': 'middle' },
        doc.createTextNode(dayLabel(r.date))));
    }
  });
  return el('figure', { class: 'ttc-figure', ownerDocument: doc }, legend(doc, series), chart,
    valuesTable(doc, { caption: label, rows, series, format }));
}

/**
 * One line per series over the days, on one shared y-axis.
 * @param {{rows: {date: string}[], series: {key: string, label: string}[], label: string}} opts
 */
export function lineChart(doc, { rows, series, label, format = compact }) {
  const values = rows.flatMap((r) => series.map((s) => r[s.key])).filter((v) => typeof v === 'number');
  const top = Math.max(...values);
  const bottom = Math.min(...values);
  const span = top - bottom || 1;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (rows.length < 2 ? 0 : (i / (rows.length - 1)) * (W - PAD.left - PAD.right));
  const y = (v) => PAD.top + ((top - v) / span) * plotH;
  const chart = frame(doc, label);
  chart.append(svg(doc, 'line', { x1: PAD.left, x2: W - PAD.right, y1: H - PAD.bottom, y2: H - PAD.bottom, class: 'ttc-axis' }));
  series.forEach((s, j) => {
    const points = rows.map((r, i) => (typeof r[s.key] === 'number' ? [x(i), y(r[s.key]), r] : null)).filter(Boolean);
    if (!points.length) return;
    const colour = `ttc-c${SERIES_ORDER[j]}`;
    chart.append(svg(doc, 'polyline', {
      points: points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' '), class: `ttc-line ${colour}`,
    }));
    const [lx, ly, lr] = points[points.length - 1];
    chart.append(titled(doc, svg(doc, 'circle', { cx: lx, cy: ly, r: 4, class: `ttc-mark ${colour}` }),
      `${dayLabel(lr.date)} · ${s.label}: ${format(lr[s.key])}`));
  });
  for (const i of [0, rows.length - 1]) {
    if (!rows[i] || (i === 0 && rows.length < 2)) continue;
    chart.append(svg(doc, 'text', { x: x(i), y: H - 6, class: 'ttc-tick', 'text-anchor': i === 0 ? 'start' : 'end' },
      doc.createTextNode(dayLabel(rows[i].date))));
  }
  return el('figure', { class: 'ttc-figure', ownerDocument: doc }, legend(doc, series), chart,
    valuesTable(doc, { caption: label, rows, series, format }));
}

/** The chart styles, for a page that declared `--ttc-chart-1` … `--ttc-chart-4`. */
export const CHART_STYLE = `
  .ttc-figure { margin: 0; }
  .ttc-chart { display: block; width: 100%; height: 140px; overflow: visible; }
  .ttc-axis { stroke: var(--border); stroke-width: 1; }
  .ttc-tick { fill: var(--muted-foreground); font-size: 12px; }
  .ttc-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
  .ttc-line.ttc-c1 { stroke: var(--ttc-chart-1); } .ttc-line.ttc-c2 { stroke: var(--ttc-chart-2); }
  .ttc-line.ttc-c3 { stroke: var(--ttc-chart-3); } .ttc-line.ttc-c4 { stroke: var(--ttc-chart-4); }
  .ttc-mark.ttc-c1, .ttc-swatch.ttc-c1 { fill: var(--ttc-chart-1); background: var(--ttc-chart-1); }
  .ttc-mark.ttc-c2, .ttc-swatch.ttc-c2 { fill: var(--ttc-chart-2); background: var(--ttc-chart-2); }
  .ttc-mark.ttc-c3, .ttc-swatch.ttc-c3 { fill: var(--ttc-chart-3); background: var(--ttc-chart-3); }
  .ttc-mark.ttc-c4, .ttc-swatch.ttc-c4 { fill: var(--ttc-chart-4); background: var(--ttc-chart-4); }
  circle.ttc-mark { stroke: var(--card); stroke-width: 2; }
  .ttc-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0 0 6px; padding: 0; list-style: none; font-size: 12px; color: var(--muted-foreground); }
  .ttc-legend li { display: inline-flex; align-items: center; gap: 6px; }
  .ttc-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
  .ttc-values { margin-top: 6px; font-size: 12px; color: var(--muted-foreground); }
  .ttc-values summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; }
  .ttc-values table { width: 100%; border-collapse: collapse; color: var(--foreground); }
  .ttc-values caption { text-align: left; color: var(--muted-foreground); padding-bottom: 4px; }
  .ttc-values th, .ttc-values td { padding: 4px 6px; text-align: right; border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; }
  .ttc-values th:first-child { text-align: left; }
`;

/** The series colours per theme: the site's own chart-1 to chart-4 (hq #679). */
const seriesOf = (theme) => Object.freeze([1, 2, 3, 4].map((n) => TOKENS[theme][`chart-${n}`]));
export const CHART_COLOURS = Object.freeze({ light: seriesOf('light'), dark: seriesOf('dark') });

/** `--ttc-chart-N: colour;` for a theme. */
export function chartDeclarations(theme) {
  return CHART_COLOURS[theme === 'light' ? 'light' : 'dark'].map((c, i) => `--ttc-chart-${i + 1}: ${c};`).join(' ');
}

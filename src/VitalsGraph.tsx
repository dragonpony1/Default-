import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

// The vital-signs graph: a value-vs-time plot over the same time columns as
// the charting grid. Systolic BP is a down-chevron, diastolic an up-caret,
// heart rate a dot. The first reading of each series is entered as a number;
// the program carries that value forward into every later column, and each
// mark can be dragged up or down to the real reading.

export type Series = 'sys' | 'dia' | 'hr';
export type VitalsData = Record<Series, Record<string, number>>;

interface Props {
  cols: number;
  rowHeight: number; // inches, per 20-mmHg gridline row
  vitals: VitalsData;
  setVitals: (next: VitalsData) => void;
}

const MAX = 200;
const GRID_STEP = 20; // horizontal gridline every 20 units → 11 lines (0..200)
const SERIES: Series[] = ['sys', 'dia', 'hr'];

// Displayed value at a column = the most recent explicit entry at or before it
// (step carry-forward). Returns null before the first entry.
function valueAt(entries: Record<string, number>, col: number): number | null {
  let v: number | null = null;
  for (let c = 0; c <= col; c++) {
    const e = entries[c];
    if (e != null) v = e;
  }
  return v;
}

function firstCol(entries: Record<string, number>): number | null {
  const cols = Object.keys(entries).map(Number);
  return cols.length ? Math.min(...cols) : null;
}

export default function VitalsGraph({ cols, rowHeight, vitals, setVitals }: Props) {
  const plotRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ series: Series; col: number } | null>(null);

  const rows = MAX / GRID_STEP; // 10 intervals
  const labels = Array.from({ length: rows + 1 }, (_, i) => MAX - i * GRID_STEP); // 200..0

  const leftPct = (col: number) => ((col + 0.5) / cols) * 100;
  const topPct = (value: number) => ((MAX - value) / MAX) * 100;

  const setEntry = (series: Series, col: number, value: number) => {
    const v = Math.max(0, Math.min(MAX, Math.round(value)));
    setVitals({ ...vitals, [series]: { ...vitals[series], [col]: v } });
  };

  const valueFromClientY = (clientY: number): number => {
    const rect = plotRef.current!.getBoundingClientRect();
    const frac = (clientY - rect.top) / rect.height;
    return MAX * (1 - frac);
  };

  const onPointerDown = (series: Series, col: number) => (e: ReactPointerEvent) => {
    e.preventDefault();
    drag.current = { series, col };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setEntry(drag.current.series, drag.current.col, valueFromClientY(e.clientY));
  };

  const endDrag = () => {
    drag.current = null;
  };

  // Marks + carry-forward line for one series.
  const seriesLayer = (series: Series) => {
    const entries = vitals[series];
    const start = firstCol(entries);
    if (start == null) return null;

    const points: Array<{ col: number; value: number }> = [];
    for (let c = start; c < cols; c++) {
      const v = valueAt(entries, c);
      if (v != null) points.push({ col: c, value: v });
    }

    const poly = points.map((p) => `${leftPct(p.col)},${topPct(p.value)}`).join(' ');
    const stroke = series === 'sys' ? '#b02a2a' : series === 'dia' ? '#2a5db0' : '#1a7a3a';

    return (
      <div className={`vg-series vg-${series}`} key={series}>
        <svg className="vg-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={poly} fill="none" stroke={stroke} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p) => {
          const explicit = entries[p.col] != null;
          return (
            <div
              key={p.col}
              className={`vg-mark vg-${series}${explicit ? ' explicit' : ''}`}
              style={{ left: `${leftPct(p.col)}%`, top: `${topPct(p.value)}%` }}
              onPointerDown={onPointerDown(series, p.col)}
              title={`${series.toUpperCase()} ${p.value} @ col ${p.col}`}
            >
              <span className="vg-glyph">
                {series === 'sys' ? '⌄' : series === 'dia' ? '⌃' : '●'}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="vg" style={{ height: `${rowHeight * rows}in` }}>
      <div className="vg-labels">
        {labels.map((n) => (
          <div className="vg-label" key={n}>{n} &mdash;</div>
        ))}
      </div>
      <div
        className="vg-plot"
        ref={plotRef}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Gridlines */}
        <svg className="vg-grid" viewBox={`0 0 ${cols * 5} ${MAX}`} preserveAspectRatio="none" aria-hidden="true">
          {Array.from({ length: cols * 5 + 1 }, (_, x) => (
            <line key={x} x1={x} y1="0" x2={x} y2={MAX} stroke="#bbb" strokeWidth={x % 5 === 0 ? 0.4 : 0.15} />
          ))}
          {labels.map((n) => (
            <line key={n} x1="0" y1={MAX - n} x2={cols * 5} y2={MAX - n} stroke="#bbb" strokeWidth="0.2" />
          ))}
        </svg>
        {SERIES.map(seriesLayer)}
      </div>
      <div className="vg-total" />
    </div>
  );
}

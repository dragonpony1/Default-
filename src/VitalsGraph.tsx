import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

// Draggable BP/HR marks rendered as an ABSOLUTE OVERLAY on top of the existing
// vital-signs crosshatch — it changes no row heights or boxes. Systolic is a
// down-chevron, diastolic an up-caret, heart rate a dot. Enter the first
// reading and the program carries it forward into every later column; drag a
// mark to set its value (vertically) and its time (horizontally), so a
// reading taken off the 5-minute grid can be placed where it actually
// happened.

export type Series = 'sys' | 'dia' | 'hr';
export type VitalsData = Record<Series, Record<string, number>>;

interface Props {
  cols: number;
  endCol: number; // last column to plot (from the anesthesia stop time)
  vitals: VitalsData;
  setVitals: (next: VitalsData) => void;
}

const MAX = 200;
const STEP_V = 20; // one crosshatch row per 20 units
const ROWS = MAX / STEP_V + 1; // 11 label rows (200..0)
const SERIES: Series[] = ['sys', 'dia', 'hr'];
const COLOR: Record<Series, string> = { sys: '#b02a2a', dia: '#2a5db0', hr: '#1a7a3a' };
const GLYPH: Record<Series, string> = { sys: '⌄', dia: '⌃', hr: '●' };

// Displayed value at a column = most recent explicit entry at or before it.
function valueAt(entries: Record<string, number>, col: number): number | null {
  let v: number | null = null;
  for (let c = 0; c <= col; c++) if (entries[c] != null) v = entries[c];
  return v;
}
function firstCol(entries: Record<string, number>): number | null {
  const cols = Object.keys(entries).map(Number);
  return cols.length ? Math.min(...cols) : null;
}

// Labels sit at the vertical center of each crosshatch row, so value 200 is
// half a row down from the top and 0 half a row up from the bottom.
const rowIndex = (v: number) => (MAX - v) / STEP_V;
const topFrac = (v: number) => (rowIndex(v) + 0.5) / ROWS;
const valueFromFrac = (frac: number) => MAX - (frac * ROWS - 0.5) * STEP_V;

export default function VitalsGraph({ cols, endCol, vitals, setVitals }: Props) {
  const plotRef = useRef<HTMLDivElement>(null);
  // Snapshot the series when a drag starts and rebuild from it on every move,
  // so re-timing a mark is one clean move rather than a chain of
  // delete-then-set steps that can race the render.
  const drag = useRef<{ series: Series; col: number; base: Record<string, number> } | null>(null);
  // Pointer moves can outrun React's re-render; without this the handler reads
  // a stale copy and re-creates the mark it just moved away from.
  const vitalsRef = useRef(vitals);
  vitalsRef.current = vitals;

  const leftPct = (col: number) => ((col + 0.5) / cols) * 100;

  const onPointerDown = (series: Series, col: number) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // A carried-forward mark becomes its own reading as soon as it is dragged.
    drag.current = { series, col, base: { ...vitalsRef.current[series] } };
    plotRef.current?.setPointerCapture(e.pointerId); // capture on the stable overlay node
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const rect = plotRef.current!.getBoundingClientRect();
    const value = Math.max(0, Math.min(MAX, Math.round(valueFromFrac((e.clientY - rect.top) / rect.height))));
    const colFrac = (e.clientX - rect.left) / rect.width;
    const nextCol = Math.max(0, Math.min(cols - 1, Math.round(colFrac * cols - 0.5)));
    const { series, col, base } = drag.current;

    const entries = { ...base };
    delete entries[col];
    entries[nextCol] = value;
    const next = { ...vitalsRef.current, [series]: entries };
    vitalsRef.current = next;
    setVitals(next);
  };

  const endDrag = () => {
    drag.current = null;
  };

  const seriesLayer = (series: Series) => {
    const entries = vitals[series];
    const start = firstCol(entries);
    if (start == null) return null;

    // Carry forward from the first reading only up to the stop column; a mark
    // dragged past the stop still shows so nothing is silently lost.
    const explicitMax = Math.max(...Object.keys(entries).map(Number));
    const last = Math.min(cols - 1, Math.max(endCol, explicitMax));
    const points: Array<{ col: number; value: number }> = [];
    for (let c = start; c <= last; c++) {
      const v = valueAt(entries, c);
      if (v != null) points.push({ col: c, value: v });
    }
    const poly = points.map((p) => `${leftPct(p.col)},${topFrac(p.value) * 100}`).join(' ');

    return (
      <div className="vg-series" key={series}>
        <svg className="vg-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={poly} fill="none" stroke={COLOR[series]} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p) => (
          <div
            key={p.col}
            className={`vg-mark vg-${series}${entries[p.col] != null ? ' explicit' : ''}`}
            style={{
              left: `${leftPct(p.col)}%`,
              top: `${topFrac(p.value) * 100}%`,
              color: COLOR[series],
              width: `${100 / cols}%`,
            }}
            onPointerDown={onPointerDown(series, p.col)}
            title={`${series.toUpperCase()} ${p.value}`}
          >
            <span className="vg-glyph">{GLYPH[series]}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="vg-overlay"
      ref={plotRef}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {SERIES.map(seriesLayer)}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { numPad } from './inputProps';
import {
  AS_NEEDED_ROWS,
  CARRY_ROWS,
  PASS_ROWS,
  STEP_SPECS,
  carriedInto,
  type PassRow,
  type StepSpec,
} from './chartRows';
import type { VitalsData, Series } from './VitalsGraph';

// Column pass: chart one five-minute time column from the top of the record
// straight down, the way the paper form is actually filled in — instead of
// hunting individual cells in the grid. The grid stays exactly as it was;
// this is another way into the same values.

interface Props {
  cells: Record<string, string>;
  vitals: VitalsData;
  times: string[];
  cols: number;
  endCol: number;
  customLabels: string[]; // user-named med rows, charted like the rest
  setCell: (key: string, value: string) => void;
  setVitals: (next: VitalsData) => void;
  onExit: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const decimals = (inc: number) => (String(inc).split('.')[1] ?? '').length;
const format = (v: number, inc: number) => {
  const s = v.toFixed(decimals(inc));
  return s.startsWith('0.') ? s.slice(1) : s;
};

// Temperature is charted in whichever scale the temp pad is set to.
const TEMP_RANGE = { F: { min: 93, max: 106, start: 98.6 }, C: { min: 34, max: 41, start: 37 } };

export default function ColumnPass({
  cells,
  vitals,
  times,
  cols,
  endCol,
  customLabels,
  setCell,
  setVitals,
  onExit,
}: Props) {
  const rows: PassRow[] = [
    ...PASS_ROWS,
    ...customLabels.map((label, i) => ({ key: `cust${i}`, label, kind: 'free' as const })),
  ];

  // Start on the first column that has nothing charted yet, so the pass walks
  // forward through the case even when charting runs behind the clock.
  const firstEmpty = () => {
    const used = (c: number) =>
      rows.some((r) => (r.kind === 'vital' ? vitals[r.key as Series]?.[c] != null : cells[`${r.key}:${c}`] !== undefined));
    for (let c = 0; c < cols; c++) if (!used(c)) return c;
    return cols - 1;
  };

  const [col, setCol] = useState(firstEmpty);
  const [showAsNeeded, setShowAsNeeded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Moving to another column starts the pass from its top again.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [col]);

  const at = times[col] || `column ${col + 1}`;

  const specFor = (r: PassRow): StepSpec | undefined => r.spec ?? STEP_SPECS[r.key];

  // What the chart shows in this cell right now: an explicit entry, else the
  // value carried in from earlier.
  const shownValue = (r: PassRow): { value: string; carried: boolean } => {
    if (r.kind === 'vital') {
      const own = vitals[r.key as Series]?.[col];
      if (own != null) return { value: String(own), carried: false };
      let last: number | null = null;
      for (let c = 0; c < col; c++) {
        const v = vitals[r.key as Series]?.[c];
        if (v != null) last = v;
      }
      return { value: last == null ? '' : String(last), carried: last != null };
    }
    const own = cells[`${r.key}:${col}`];
    if (own !== undefined) return { value: own, carried: false };
    const carried = CARRY_ROWS.has(r.key) ? carriedInto(cells, r.key, col) : '';
    return { value: carried, carried: carried !== '' };
  };

  const write = (r: PassRow, value: string) => {
    if (r.kind === 'vital') {
      const series = r.key as Series;
      const next = { ...vitals[series] };
      if (value === '') delete next[col];
      else next[col] = Math.round(Number(value));
      setVitals({ ...vitals, [series]: next });
      return;
    }
    setCell(`${r.key}:${col}`, value);
  };

  const nudge = (r: PassRow, dir: 1 | -1) => {
    const spec = specFor(r);
    const { value } = shownValue(r);
    if (r.kind === 'temp') {
      const scale = localStorage.getItem('temppad-scale-v1') === 'C' ? 'C' : 'F';
      const range = TEMP_RANGE[scale];
      const cur = Number(value) || range.start;
      write(r, (Math.round((cur + dir * 0.1) * 10) / 10).toFixed(1));
      return;
    }
    if (!spec) return;
    const cur = value === '' ? spec.start : Number(value);
    const nextVal = clamp((Number.isFinite(cur) ? cur : spec.start) + dir * spec.inc, spec.min, spec.max);
    write(r, format(nextVal, spec.inc));
  };

  const rowControl = (r: PassRow) => {
    const { value } = shownValue(r);
    const spec = specFor(r);

    if (r.kind === 'chips') {
      return (
        <div className="chips wrap cp-chips">
          {(r.options ?? []).map((o) => (
            <button
              key={o}
              type="button"
              className={`chip${value === o ? ' on' : ''}`}
              onClick={() => write(r, value === o ? '' : o)}
            >
              {o}
            </button>
          ))}
        </div>
      );
    }

    if (r.kind === 'free') {
      return (
        <input
          {...numPad}
          className="cp-input"
          value={cells[`${r.key}:${col}`] ?? ''}
          placeholder="—"
          onChange={(e) => setCell(`${r.key}:${col}`, e.target.value)}
        />
      );
    }

    const scale = localStorage.getItem('temppad-scale-v1') === 'C' ? 'C' : 'F';
    const range = r.kind === 'temp' ? TEMP_RANGE[scale] : null;
    const min = range ? range.min : spec!.min;
    const max = range ? range.max : spec!.max;
    const inc = range ? 0.1 : spec!.inc;
    const cur = value === '' ? (range ? range.start : spec!.start) : Number(value);

    return (
      <div className="cp-slider-row">
        <button type="button" className="cp-nudge" onClick={() => nudge(r, -1)} aria-label="down">−</button>
        <input
          type="range"
          className="tp-slider"
          min={min}
          max={max}
          step={inc}
          value={Number.isFinite(cur) ? cur : min}
          onChange={(e) => write(r, range ? Number(e.target.value).toFixed(1) : format(Number(e.target.value), inc))}
        />
        <button type="button" className="cp-nudge" onClick={() => nudge(r, 1)} aria-label="up">+</button>
      </div>
    );
  };

  const rowCard = (r: PassRow) => {
    const { value, carried } = shownValue(r);
    return (
      <div className={`cp-row${carried ? ' carried' : ''}${value === '' ? ' empty' : ''}`} key={r.key}>
        <div className="cp-rowhead">
          <span className="cp-label">{r.label}</span>
          <span className="cp-value">
            {value === '' ? '—' : value}
            {value !== '' && r.unit ? <span className="cp-unit"> {r.unit}</span> : null}
            {carried && <span className="cp-carried">carried</span>}
          </span>
          {value !== '' && (
            <button type="button" className="cp-clear" onClick={() => write(r, '')} aria-label="clear">✕</button>
          )}
        </div>
        {rowControl(r)}
      </div>
    );
  };

  return (
    <div className="cp screen-only">
      <div className="cp-bar">
        <button type="button" className="chip" onClick={() => setCol((c) => Math.max(0, c - 1))}>← earlier</button>
        <span className="cp-time">
          <span className="cp-timeval">{at}</span>
          <span className="cp-timehint">
            {col > endCol ? 'after anesthesia stop' : `column ${col + 1} of ${cols}`}
          </span>
        </span>
        <button type="button" className="chip" onClick={() => setCol((c) => Math.min(cols - 1, c + 1))}>later →</button>
        <button type="button" className="chip on cp-done" onClick={onExit}>Done</button>
      </div>

      <div className="cp-list" ref={listRef}>
        {rows.map(rowCard)}

        <button type="button" className="chip cp-more" onClick={() => setShowAsNeeded(!showAsNeeded)}>
          {showAsNeeded ? 'Hide' : 'Show'} drugs &amp; totals given this round
        </button>
        {showAsNeeded && AS_NEEDED_ROWS.map(rowCard)}

        <div className="cp-foot">
          <button
            type="button"
            className="chip on cp-next"
            onClick={() => setCol((c) => Math.min(cols - 1, c + 1))}
          >
            Next column ({times[Math.min(cols - 1, col + 1)] || '—'}) →
          </button>
        </div>
      </div>
    </div>
  );
}

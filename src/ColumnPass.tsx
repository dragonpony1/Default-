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
  ck: Record<string, boolean>;
  setCk: (key: string, value: boolean) => void;
  vitals: VitalsData;
  times: string[];
  cols: number;
  endCol: number;
  stepMin: number; // minutes a column covers
  onStartNow: () => void; // set the surgery start so the columns get clock times
  customLabels: string[]; // user-named med rows, charted like the rest
  setCell: (key: string, value: string) => void;
  setVitals: (next: VitalsData) => void;
  onExit: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const decimals = (inc: number) => (String(inc).split('.')[1] ?? '').length;
const format = (v: number, inc: number) => {
  // Trailing zeros waste room in cells this small: 3, not 3.0.
  const s = v.toFixed(decimals(inc)).replace(/\.0+$/, '');
  // FiO2 and ET% are charted as bare decimals — ".5" fits a cell, "0.5" does not.
  return s.startsWith('0.') ? s.slice(1) : s;
};

// Temperature is charted in whichever scale the temp pad is set to.
const TEMP_RANGE = { F: { min: 93, max: 106, start: 98.6 }, C: { min: 34, max: 41, start: 37 } };

export default function ColumnPass({
  cells,
  ck,
  setCk,
  vitals,
  times,
  cols,
  endCol,
  stepMin,
  onStartNow,
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

  // Charting is done by the clock, so a column is its time. Until the case has
  // a start time there is nothing to count from — the tool says so and offers
  // to set it rather than falling back to "column 3".
  const noClock = !times[0];
  const at = times[col] || '--:--';

  // Charting runs behind the clock as often as not; this lands on the column
  // for the time it actually is, rather than counting forward by hand.
  const nowCol = (() => {
    const n = new Date();
    const mins = n.getHours() * 60 + n.getMinutes();
    let best = -1;
    let bestDiff = Infinity;
    times.forEach((t, i) => {
      if (!/^\d{4}$/.test(t)) return;
      const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(2));
      const diff = Math.abs(m - mins);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    });
    return best;
  })();

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

  // Write the whole column down as it stands — the values just adjusted plus
  // the ones carried in — exactly as a column is filled in on paper, so every
  // five-minute slot on the printed chart carries its own figures.
  const fillColumn = () => {
    rows.forEach((r) => {
      const { value } = shownValue(r);
      if (value === '') return;
      write(r, value); // writing a value it already holds is harmless
    });
  };

  const filledCount = rows.filter((r) => {
    const { value, carried } = shownValue(r);
    return value !== '' && !carried;
  }).length;

  // Anything showing in the column — adjusted or carried — can be written
  // down. Only a column with nothing in it at all has nothing to fill.
  const fillableCount = rows.filter((r) => shownValue(r).value !== '').length;

  // Wipe this time column — every row of it, including the drugs and totals —
  // for a column charted in the wrong slot.
  const clearColumn = () => {
    const entries = [...rows, ...AS_NEEDED_ROWS].filter((r) => {
      if (r.kind === 'vital') return vitals[r.key as Series]?.[col] != null;
      return cells[`${r.key}:${col}`] !== undefined;
    });
    if (!entries.length) return;
    if (!window.confirm(`Clear everything charted at ${at}? ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} will be removed.`)) return;
    const nextVitals = { sys: { ...vitals.sys }, dia: { ...vitals.dia }, hr: { ...vitals.hr } };
    let touchedVitals = false;
    entries.forEach((r) => {
      if (r.kind === 'vital') {
        delete nextVitals[r.key as Series][col];
        touchedVitals = true;
      } else {
        setCell(`${r.key}:${col}`, '');
      }
    });
    if (touchedVitals) setVitals(nextVitals);
  };

  // One gas or the other — picking one clears the other, matching the pair of
  // boxes printed on the form.
  const pickExclusive = (r: PassRow, chosen: string) => {
    (r.exclusiveCk ?? []).forEach((o) => setCk(o.ck, o.ck === chosen ? !ck[chosen] : false));
  };

  // The value a row starts at when it has never been set: a tidal volume of
  // 500, an FiO2 of .5, 98.6 for a temperature. Nothing is written until it is
  // tapped — Fill only writes what is showing, so a row left at — stays blank.
  const startFor = (r: PassRow): string => {
    if (r.kind === 'temp') {
      const scale = localStorage.getItem('temppad-scale-v1') === 'C' ? 'C' : 'F';
      return TEMP_RANGE[scale].start.toFixed(1);
    }
    const spec = specFor(r);
    return spec ? format(spec.start, spec.inc) : '';
  };

  const rowCard = (r: PassRow) => {
    const { value, carried } = shownValue(r);
    const chosen = (r.exclusiveCk ?? []).find((o) => ck[o.ck]);
    return (
      <div className={`cp-row${carried ? ' carried' : ''}${value === '' ? ' empty' : ''}`} key={r.key}>
        <div className="cp-rowhead">
          <span className="cp-label">{chosen ? chosen.label : r.label}</span>
          <span className="cp-value">
            {value === '' ? '—' : value}
            {value !== '' && r.unit ? <span className="cp-unit"> {r.unit}</span> : null}
            {carried && <span className="cp-carried">carried</span>}
          </span>
          {value === '' ? (
            startFor(r) && (
              <button type="button" className="chip cp-start" onClick={() => write(r, startFor(r))}>
                Set {startFor(r)}{r.unit ? ` ${r.unit}` : ''}
              </button>
            )
          ) : (
            <button type="button" className="cp-clear" onClick={() => write(r, '')} aria-label="clear">✕</button>
          )}
        </div>
        {r.exclusiveCk && (
          <div className="chips wrap cp-pick">
            {r.exclusiveCk.map((o) => (
              <button
                key={o.ck}
                type="button"
                className={`chip${ck[o.ck] ? ' on' : ''}`}
                onClick={() => pickExclusive(r, o.ck)}
              >
                {o.label}
              </button>
            ))}
            {!chosen && <span className="ihint">pick one</span>}
          </div>
        )}
        {rowControl(r)}
      </div>
    );
  };

  return (
    <div className="cp screen-only">
      <div className="cp-bar">
        {/* Navigation, not charting: named so it cannot be mistaken for the
            Fill button at the foot of the list. */}
        <button
          type="button"
          className="chip cp-move"
          onClick={() => setCol((c) => Math.max(0, c - 1))}
          title="Look at the column before this one — nothing is written"
        >
          ← Back{col > 0 && times[col - 1] ? ` to ${times[col - 1]}` : ''}
        </button>
        <span className="cp-time">
          <span className="cp-timeval">{at}</span>
          <span className="cp-timehint">
            {noClock
              ? 'no start time yet'
              : col > endCol
                ? 'after anesthesia stop'
                : filledCount
                  ? `${filledCount} charted here`
                  : `${stepMin} min columns`}
          </span>
        </span>
        <button
          type="button"
          className="chip cp-move"
          onClick={() => setCol((c) => Math.min(cols - 1, c + 1))}
          title="Move on without writing this column down"
        >
          Skip{times[col + 1] ? ` to ${times[col + 1]}` : ''} →
        </button>
        {nowCol >= 0 && nowCol !== col && (
          <button type="button" className="chip" onClick={() => setCol(nowCol)} title="Jump to the column for the time it is now">
            🕐 {times[nowCol]}
          </button>
        )}
        <button type="button" className="chip on cp-done" onClick={onExit}>Done</button>
      </div>

      {noClock && (
        <div className="cp-nostart">
          <span>
            The case has no surgery start time, so the columns have no clock times to show.
          </span>
          <button type="button" className="chip on" onClick={onStartNow}>🕐 Start the case now</button>
        </div>
      )}

      <div className="cp-list" ref={listRef}>
        <p className="cp-howto">
          <b>Fill &amp; next</b>, at the foot of this list, is what charts a column: it writes down
          everything showing here and moves on. <b>Back</b> and <b>Skip</b> at the top only move
          between times — they write nothing. A row showing <b>—</b> has never been set, so there is
          nothing for Fill to write: tap <b>Set</b> to start it.
        </p>
        {rows.map(rowCard)}

        <button type="button" className="chip cp-more" onClick={() => setShowAsNeeded(!showAsNeeded)}>
          {showAsNeeded ? 'Hide' : 'Show'} drugs &amp; totals given this round
        </button>
        {showAsNeeded && AS_NEEDED_ROWS.map(rowCard)}

        <div className="cp-foot">
          <button type="button" className="chip cp-wipe" onClick={clearColumn}>
            🗑 Clear this column
          </button>
          <button
            type="button"
            className="chip cp-fill"
            onClick={fillColumn}
            disabled={fillableCount === 0}
            title="Write every value showing here down as entries for this time"
          >
            {fillableCount ? `✓ Fill in ${at} (${fillableCount})` : 'Nothing to fill yet'}
          </button>
          <button
            type="button"
            className="chip on cp-next"
            onClick={() => {
              fillColumn();
              setCol((c) => Math.min(cols - 1, c + 1));
            }}
          >
            Fill &amp; next ({times[Math.min(cols - 1, col + 1)] || `+${stepMin} min`}) →
          </button>
        </div>
      </div>
    </div>
  );
}

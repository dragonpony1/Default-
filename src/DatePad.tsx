import { useEffect, useRef, useState } from 'react';
import { loadPadPos, padStyle, posFromPointer, savePadPos, useViewport } from './viewportAnchor';

// Floating date picker for the date boxes on the forms. Today is one tap;
// the wheels cover anything else. Writes MM/DD/YY, which is what the printed
// forms carry. Same floating, draggable pad as the 10-key and the temp
// slider, so a date box behaves like every other box on the record.

const POS_KEY = 'datepad-pos-v1';

function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${String(d.getFullYear()).slice(-2)}`;

const shift = (days: number) => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + days);
};

// Parsed as month/day/year so the wheels open on whatever is already there.
function parse(value: string): { m: number; d: number; y: number } {
  const now = new Date();
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return { m: now.getMonth() + 1, d: now.getDate(), y: now.getFullYear() };
  const yr = Number(m[3]);
  return { m: Number(m[1]), d: Number(m[2]), y: yr < 100 ? 2000 + yr : yr };
}

const daysIn = (m: number, y: number) => new Date(y, m, 0).getDate();

export default function DatePad() {
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [pos, setPos] = useState(() => loadPadPos(POS_KEY));
  const vp = useViewport();
  const padRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.dataset.datepad === '1') {
        setTarget(el);
      } else if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) &&
        !(el instanceof HTMLInputElement && el.dataset.datepad === '1')
      ) {
        setTarget(null);
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => {
      if (!target.isConnected) setTarget(null);
    }, 500);
    return () => clearInterval(t);
  }, [target]);

  if (!target) return null;

  const cur = parse(target.value);
  const year = new Date().getFullYear();

  const write = (m: number, d: number, y: number) => {
    const day = Math.min(d, daysIn(m, y));
    setNativeValue(target, `${pad2(m)}/${pad2(day)}/${String(y).slice(-2)}`);
  };

  const done = () => {
    target.blur();
    setTarget(null);
  };

  const startDrag = (e: React.PointerEvent) => {
    drag.current = { dx: 0, dy: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDrag = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos(posFromPointer(vp, e.clientX, e.clientY));
  };

  const endDrag = () => {
    if (drag.current && pos) savePadPos(POS_KEY, pos);
    drag.current = null;
  };

  const noFocus = (e: React.PointerEvent) => e.preventDefault();
  const style = padStyle(vp, pos, 280, 250);

  const quick = (label: string, days: number) => {
    const val = fmt(shift(days));
    return (
      <button
        type="button"
        className={`chip${target.value === val ? ' on' : ''}`}
        onPointerDown={noFocus}
        onClick={() => setNativeValue(target, val)}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="np dp screen-only" ref={padRef} style={style}>
      <div
        className="np-handle"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="np-grip">⠿ date</span>
        <button type="button" className="np-close" onPointerDown={noFocus} onClick={done}>✕</button>
      </div>

      <div className="dp-value">{target.value || '—'}</div>

      <div className="chips wrap dp-quick">
        {quick('Yesterday', -1)}
        {quick('Today', 0)}
        {quick('Tomorrow', 1)}
      </div>

      <div className="dp-wheels">
        <label className="dtf-wheel">
          <span>Month</span>
          <select value={cur.m} onChange={(e) => write(Number(e.target.value), cur.d, cur.y)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{pad2(m)}</option>
            ))}
          </select>
        </label>
        <label className="dtf-wheel">
          <span>Day</span>
          <select value={Math.min(cur.d, daysIn(cur.m, cur.y))} onChange={(e) => write(cur.m, Number(e.target.value), cur.y)}>
            {Array.from({ length: daysIn(cur.m, cur.y) }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{pad2(d)}</option>
            ))}
          </select>
        </label>
        <label className="dtf-wheel">
          <span>Year</span>
          <select value={cur.y} onChange={(e) => write(cur.m, cur.d, Number(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="np-bottom">
        <button
          type="button"
          className="np-key np-fn np-small"
          onPointerDown={noFocus}
          onClick={() => {
            setNativeValue(target, '');
            done();
          }}
        >
          Clear
        </button>
        <button type="button" className="np-key np-done" onPointerDown={noFocus} onClick={done}>Done</button>
      </div>
    </div>
  );
}

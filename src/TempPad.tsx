import { useEffect, useRef, useState } from 'react';
import { loadPadPos, padStyle, posFromPointer, savePadPos, useViewport } from './viewportAnchor';

// Floating slider for temperature fields — drag the slider (or nudge ±0.1)
// instead of typing. Appears when a temp-marked input focuses, remembers its
// screen position and °F/°C preference per device, and writes straight into
// the focused field.

const POS_KEY = 'temppad-pos-v2';
const SCALE_KEY = 'temppad-scale-v1';

const RANGES = {
  F: { min: 93, max: 106, start: 98.6 },
  C: { min: 34, max: 41, start: 37 },
} as const;
type Scale = keyof typeof RANGES;

function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function TempPad() {
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [scale, setScale] = useState<Scale>(() => (localStorage.getItem(SCALE_KEY) === 'C' ? 'C' : 'F'));
  const [val, setVal] = useState<number>(RANGES.F.start);
  const [pos, setPos] = useState(() => loadPadPos(POS_KEY));
  const vp = useViewport();
  const padRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.dataset.temp === '1') {
        setTarget(el);
        const r = RANGES[localStorage.getItem(SCALE_KEY) === 'C' ? 'C' : 'F'];
        const parsed = Number(el.value);
        setVal(!Number.isNaN(parsed) && parsed >= r.min && parsed <= r.max ? parsed : r.start);
      } else if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) &&
        !(el instanceof HTMLInputElement && el.dataset.temp === '1')
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

  const r = RANGES[scale];

  const apply = (v: number) => {
    const rounded = Math.round(v * 10) / 10;
    setVal(rounded);
    setNativeValue(target, rounded.toFixed(1));
  };

  const switchScale = (next: Scale) => {
    if (next === scale) return;
    // Convert the current reading so the mark stays the same temperature.
    const converted = next === 'C' ? ((val - 32) * 5) / 9 : (val * 9) / 5 + 32;
    const nr = RANGES[next];
    setScale(next);
    localStorage.setItem(SCALE_KEY, next);
    apply(clamp(Math.round(converted * 10) / 10, nr.min, nr.max));
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
  const style = padStyle(vp, pos, 300, 230);



  return (
    <div className="np tp screen-only" ref={padRef} style={style}>
      <div
        className="np-handle"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="np-grip">⠿ drag</span>
        <span className="tp-scale">
          <button type="button" className={`chip tp-chip${scale === 'F' ? ' on' : ''}`} onPointerDown={noFocus} onClick={() => switchScale('F')}>°F</button>
          <button type="button" className={`chip tp-chip${scale === 'C' ? ' on' : ''}`} onPointerDown={noFocus} onClick={() => switchScale('C')}>°C</button>
        </span>
        <button type="button" className="np-close" onPointerDown={noFocus} onClick={done}>✕</button>
      </div>
      <div className="tp-value">{val.toFixed(1)}<span className="tp-unit">°{scale}</span></div>
      <div className="tp-slider-row">
        <button type="button" className="np-key tp-nudge" onPointerDown={noFocus} onClick={() => apply(clamp(val - 0.1, r.min, r.max))}>−0.1</button>
        <input
          type="range"
          className="tp-slider"
          min={r.min}
          max={r.max}
          step={0.1}
          value={val}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => apply(Number(e.target.value))}
        />
        <button type="button" className="np-key tp-nudge" onPointerDown={noFocus} onClick={() => apply(clamp(val + 0.1, r.min, r.max))}>+0.1</button>
      </div>
      <div className="np-bottom tp-bottom">
        <button type="button" className="np-key np-done" onPointerDown={noFocus} onClick={done}>Done</button>
      </div>
    </div>
  );
}

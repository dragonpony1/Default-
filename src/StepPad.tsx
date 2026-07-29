import { useEffect, useRef, useState } from 'react';
import { loadPadPos, padStyle, posFromPointer, savePadPos, useViewport } from './viewportAnchor';

// Floating slider for the continuously-running chart values — vent settings,
// gas flows, EtCO2, SaO2, TO4. Nudge a value by one step or sweep the slider,
// instead of retyping it. Range and step come from the focused cell, so each
// row gets sensible limits. Draggable, and remembers where it was parked.

const POS_KEY = 'steppad-pos-v2';

function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Spec {
  min: number;
  max: number;
  inc: number;
  label: string;
  unit: string;
  at: string; // clock time of the column being charted
}

function specOf(el: HTMLInputElement): Spec | null {
  const min = Number(el.dataset.stepMin);
  const max = Number(el.dataset.stepMax);
  const inc = Number(el.dataset.stepInc);
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(inc)) return null;
  return { min, max, inc, label: el.dataset.stepLabel ?? '', unit: el.dataset.stepUnit ?? '', at: el.dataset.stepAt ?? '' };
}

// Match the step's precision so 0.05 steps don't produce 0.35000000000000003.
const decimals = (inc: number) => (String(inc).split('.')[1] ?? '').length;
const format = (v: number, inc: number) => {
  const s = v.toFixed(decimals(inc));
  // FiO2 and ET% are charted as bare decimals — ".5" fits a cell, "0.5" does not.
  return s.startsWith('0.') ? s.slice(1) : s;
};

export default function StepPad() {
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [val, setVal] = useState(0);
  const [pos, setPos] = useState(() => loadPadPos(POS_KEY));
  const vp = useViewport();
  const padRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.dataset.stepMin != null && el.dataset.useKeys !== '1') {
        const sp = specOf(el);
        if (!sp) return;
        setTarget(el);
        setSpec(sp);
        const parsed = Number(el.value);
        setVal(Number.isFinite(parsed) && el.value.trim() !== '' ? clamp(parsed, sp.min, sp.max) : Number(el.dataset.stepStart ?? sp.min));
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
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

  if (!target || !spec) return null;

  const apply = (v: number) => {
    const next = clamp(v, spec.min, spec.max);
    setVal(next);
    setNativeValue(target, format(next, spec.inc));
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
        <span className="np-grip">⠿ {spec.label}{spec.at && <span className="np-at"> @ {spec.at}</span>}</span>
        <button type="button" className="np-close" onPointerDown={noFocus} onClick={done}>✕</button>
      </div>
      <div className="tp-value">
        {format(val, spec.inc)}
        {spec.unit && <span className="tp-unit">{spec.unit}</span>}
      </div>
      <div className="tp-slider-row">
        <button type="button" className="np-key tp-nudge" onPointerDown={noFocus} onClick={() => apply(val - spec.inc)}>
          −{format(spec.inc, spec.inc)}
        </button>
        <input
          type="range"
          className="tp-slider"
          min={spec.min}
          max={spec.max}
          step={spec.inc}
          value={val}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => apply(Number(e.target.value))}
        />
        <button type="button" className="np-key tp-nudge" onPointerDown={noFocus} onClick={() => apply(val + spec.inc)}>
          +{format(spec.inc, spec.inc)}
        </button>
      </div>
      <div className="np-bottom np-bottom3">
        <button
          type="button"
          className="np-key np-fn np-small"
          onPointerDown={noFocus}
          onClick={() => {
            // Take the value back out of the cell entirely.
            setNativeValue(target, '');
            done();
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="np-key np-fn np-small"
          onPointerDown={noFocus}
          onClick={() => {
            // Hand this cell to the 10-key for a value off the slider's range.
            const el = target;
            el.dataset.useKeys = '1';
            setTarget(null);
            el.blur();
            setTimeout(() => el.focus(), 50);
          }}
        >
          123
        </button>
        <button type="button" className="np-key np-done" onPointerDown={noFocus} onClick={done}>Done</button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

// Floating, draggable 10-key pad for numeric entry. Any input carrying the
// numPad props (inputMode="none" + data-np) summons it on focus instead of
// the OS keyboard; taps type into the focused field. The pad can be dragged
// anywhere by its handle and remembers its position per device. The ABC key
// hands one field back to the OS keyboard when free text is needed.

const POS_KEY = 'numpad-pos-v1';

// React controlled inputs ignore direct .value writes; go through the native
// setter and fire an input event so onChange handlers run normally.
function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { x: number; y: number };
    return typeof p.x === 'number' && typeof p.y === 'number' ? p : null;
  } catch {
    return null;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function NumPad() {
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [pos, setPos] = useState(loadPos);
  const padRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.dataset.np === '1' && el.dataset.osKb !== '1') {
        setTarget(el);
      } else if (
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) &&
        !(el instanceof HTMLInputElement && el.dataset.np === '1')
      ) {
        // Focus moved to an ordinary field — the OS keyboard owns it; get out
        // of the way.
        setTarget(null);
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  // Field removed from the page (tab switch, wizard step) → hide.
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => {
      if (!target.isConnected) setTarget(null);
    }, 500);
    return () => clearInterval(t);
  }, [target]);

  if (!target) return null;

  const type = (ch: string) => {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const next = target.value.slice(0, start) + ch + target.value.slice(end);
    setNativeValue(target, next);
    target.setSelectionRange(start + ch.length, start + ch.length);
  };

  const backspace = () => {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    const next = target.value.slice(0, from) + target.value.slice(end);
    setNativeValue(target, next);
    target.setSelectionRange(from, from);
  };

  const clearAll = () => {
    setNativeValue(target, '');
    target.setSelectionRange(0, 0);
  };

  const done = () => {
    target.blur();
    setTarget(null);
  };

  // Hand this one field back to the OS keyboard (until the page reloads).
  const abc = () => {
    target.dataset.osKb = '1';
    target.setAttribute('inputmode', 'text');
    const el = target;
    setTarget(null);
    el.blur();
    setTimeout(() => el.focus(), 50);
  };

  const startDrag = (e: React.PointerEvent) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDrag = (e: React.PointerEvent) => {
    if (!drag.current || !padRef.current) return;
    const w = padRef.current.offsetWidth;
    const h = padRef.current.offsetHeight;
    const x = clamp(e.clientX - drag.current.dx, 0, window.innerWidth - w);
    const y = clamp(e.clientY - drag.current.dy, 0, window.innerHeight - h);
    setPos({ x, y });
  };

  const endDrag = () => {
    if (drag.current && pos) localStorage.setItem(POS_KEY, JSON.stringify(pos));
    drag.current = null;
  };

  // Taps on pad buttons must not steal focus from the input.
  const noFocus = (e: React.PointerEvent) => e.preventDefault();

  const key = (label: string, act: () => void, cls = '') => (
    <button
      type="button"
      className={`np-key ${cls}`}
      onPointerDown={noFocus}
      onClick={act}
    >
      {label}
    </button>
  );

  const style = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : undefined;

  return (
    <div className="np screen-only" ref={padRef} style={style}>
      <div
        className="np-handle"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="np-grip">⠿ drag</span>
        <button type="button" className="np-close" onPointerDown={noFocus} onClick={done}>✕</button>
      </div>
      <div className="np-grid">
        {key('7', () => type('7'))}
        {key('8', () => type('8'))}
        {key('9', () => type('9'))}
        {key('⌫', backspace, 'np-fn')}
        {key('4', () => type('4'))}
        {key('5', () => type('5'))}
        {key('6', () => type('6'))}
        {key('/', () => type('/'), 'np-fn')}
        {key('1', () => type('1'))}
        {key('2', () => type('2'))}
        {key('3', () => type('3'))}
        {key(':', () => type(':'), 'np-fn')}
        {key('.', () => type('.'))}
        {key('0', () => type('0'))}
        {key('Clear', clearAll, 'np-fn np-small')}
        {key('-', () => type('-'), 'np-fn')}
      </div>
      <div className="np-bottom">
        {key('ABC', abc, 'np-fn np-small')}
        {key('Done', done, 'np-done')}
      </div>
    </div>
  );
}

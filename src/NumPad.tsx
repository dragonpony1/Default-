import { useEffect, useRef, useState } from 'react';
import { loadPadPos, padStyle, posFromPointer, savePadPos, useViewport } from './viewportAnchor';

// Floating, draggable 10-key pad for numeric entry. Any input carrying the
// numPad props (inputMode="none" + data-np) summons it on focus instead of
// the OS keyboard; taps type into the focused field. The pad can be dragged
// anywhere by its handle and remembers its position per device. The ABC key
// hands one field back to the OS keyboard when free text is needed.

const POS_KEY = 'numpad-pos-v2';

// React controlled inputs ignore direct .value writes; go through the native
// setter and fire an input event so onChange handlers run normally.
function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function NumPad() {
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [pos, setPos] = useState(() => loadPadPos(POS_KEY));
  const vp = useViewport();
  const padRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (
        el instanceof HTMLInputElement &&
        el.dataset.np === '1' &&
        el.dataset.osKb !== '1' &&
        // Cells with a slider get the slider, unless "123" was tapped on it.
        (el.dataset.stepMin == null || el.dataset.useKeys === '1')
      ) {
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
    delete target.dataset.useKeys;
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

  // Taps on pad buttons must not steal focus from the input.
  const noFocus = (e: React.PointerEvent) => e.preventDefault();
  const style = padStyle(vp, pos, 240, 300);

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
      <div className={`np-bottom${target.dataset.npo === '1' ? ' np-bottom4' : target.dataset.timefield === '1' ? ' np-bottom3' : ''}`}>
        {key('ABC', abc, 'np-fn np-small')}
        {/* NPO is midnight far more often than it is a clock time. */}
        {target.dataset.npo === '1' &&
          key('🌙 Midnight', () => setNativeValue(target, 'Midnight'), 'np-fn np-now')}
        {/* Times are nearly always "right now" — one key beats four taps. */}
        {target.dataset.timefield === '1' &&
          key('🕐 Now', () => {
            const n = new Date();
            setNativeValue(target, `${String(n.getHours()).padStart(2, '0')}${String(n.getMinutes()).padStart(2, '0')}`);
          }, 'np-fn np-now')}
        {key('Done', done, 'np-done')}
      </div>
    </div>
  );
}

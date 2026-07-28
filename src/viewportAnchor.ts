import { useEffect, useState } from 'react';

// The floating pads are position:fixed, which pins them to the *page*, not to
// what you can currently see. Pinch-zoom into a small charting cell and the
// pad slides off the visible area — precisely when it is needed most. These
// helpers keep a pad inside the visual viewport and at a constant finger
// size, whatever the zoom.

export interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

function read(): Viewport {
  const vv = window.visualViewport;
  if (!vv) {
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight, scale: 1 };
  }
  return { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height, scale: vv.scale };
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read);
  useEffect(() => {
    const update = () => setVp(read());
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    update();
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);
  return vp;
}

// Saved as fractions of the visible area, so a pad parked bottom-right stays
// bottom-right no matter how the view is zoomed or the device is rotated.
export interface PadPos {
  fx: number;
  fy: number;
}

export function loadPadPos(key: string): PadPos | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as PadPos;
    return typeof p.fx === 'number' && typeof p.fy === 'number' ? p : null;
  } catch {
    return null;
  }
}

export function savePadPos(key: string, pos: PadPos): void {
  localStorage.setItem(key, JSON.stringify(pos));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Place the pad inside the visible area, countering page zoom so it keeps a
// constant on-screen size.
export function padStyle(vp: Viewport, pos: PadPos | null, padW: number, padH: number): React.CSSProperties {
  const w = padW / vp.scale;
  const h = padH / vp.scale;
  const fx = pos?.fx ?? 1;
  const fy = pos?.fy ?? 1;
  const left = vp.left + clamp(fx * vp.width - w / 2, 4 / vp.scale, Math.max(0, vp.width - w - 4 / vp.scale));
  const top = vp.top + clamp(fy * vp.height - h / 2, 4 / vp.scale, Math.max(0, vp.height - h - 4 / vp.scale));
  return {
    left,
    top,
    right: 'auto',
    bottom: 'auto',
    transform: `scale(${1 / vp.scale})`,
    transformOrigin: 'top left',
  };
}

// Pointer coordinates are in visual-viewport space when zoomed; convert a
// drag to the fractional position the pad should remember.
export function posFromPointer(vp: Viewport, clientX: number, clientY: number): PadPos {
  return {
    fx: clamp((clientX - vp.left) / vp.width, 0, 1),
    fy: clamp((clientY - vp.top) / vp.height, 0, 1),
  };
}

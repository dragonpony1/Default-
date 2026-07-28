import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

// A small signature capture pad. Draw with finger or stylus; Save returns a
// trimmed-ish PNG data URL. Used to store a provider's signature once.

interface Props {
  initial?: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function SignaturePad({ initial, onSave, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // Transparent background: the saved PNG carries ink only, so stamping it
    // onto a form never paints a pale box over the ruled line.
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = initial;
    }
  }, [initial]);

  const pos = (e: ReactPointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const down = (e: ReactPointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    // Second pass keeps thin fast strokes from washing out when the image is
    // scaled down onto a form line.
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
  };

  const save = () => {
    const c = canvasRef.current;
    if (!c) return;
    onSave(c.toDataURL('image/png'));
  };

  return (
    <div className="sigpad-backdrop" onClick={onCancel}>
      <div className="sigpad" onClick={(e) => e.stopPropagation()}>
        <div className="sigpad-title">Sign here — use your finger or stylus</div>
        <canvas
          ref={canvasRef}
          className="sigpad-canvas"
          width={900}
          height={300}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        <div className="sigpad-actions">
          <button type="button" className="chip" onClick={clear}>Clear</button>
          <span className="grow" />
          <button type="button" className="chip" onClick={onCancel}>Cancel</button>
          <button type="button" className="chip on" onClick={save}>Save signature</button>
        </div>
      </div>
    </div>
  );
}

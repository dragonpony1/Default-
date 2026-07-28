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
    ctx.lineWidth = 13;
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

  // The stamped signature is displayed only ~28px tall, so a full-canvas
  // export shrinks ~10x and antialiases the strokes into grey. Crop tightly
  // to the ink and push every partly-transparent pixel toward solid black, so
  // what survives the downscale still reads as ink.
  const save = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;

    const img = ctx.getImageData(0, 0, c.width, c.height);
    const px = img.data;
    let minX = c.width;
    let minY = c.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const a = px[(y * c.width + x) * 4 + 3];
        if (a > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      onSave(c.toDataURL('image/png'));
      return;
    }

    // Solid black ink; lift soft antialiased edges so they survive scaling.
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] > 0) {
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
        px[i + 3] = Math.min(255, Math.round(px[i + 3] * 2.5));
      }
    }
    ctx.putImageData(img, 0, 0);

    const pad = 6;
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(c.width - sx, maxX - minX + pad * 2);
    const sh = Math.min(c.height - sy, maxY - minY + pad * 2);
    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    out.getContext('2d')?.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
    onSave(out.toDataURL('image/png'));
  };

  return (
    <div className="sigpad-backdrop" onClick={onCancel}>
      <div className="sigpad" onClick={(e) => e.stopPropagation()}>
        <div className="sigpad-title">Sign here — use your finger or stylus</div>
        <canvas
          ref={canvasRef}
          className="sigpad-canvas"
          width={720}
          height={240}
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

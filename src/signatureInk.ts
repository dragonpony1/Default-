// Signature images are stamped onto form lines only ~34px tall, so whatever
// is saved gets scaled down hard. Anything soft — a thin stroke, an
// antialiased edge, an old navy-on-white capture — averages into light grey
// at that size. This turns any signature image into ink-only pixels: solid
// black, boosted coverage, cropped tight to the strokes so the downscale is
// as gentle as possible.

const THRESHOLD = 220; // luminance at/above this counts as background
const BOOST = 2.2; // lift partial coverage so edges survive the downscale
const PAD = 4;

const cache = new Map<string, string>();

export function inkifySignature(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    if (!src) {
      resolve(src);
      return;
    }
    const done = (out: string) => {
      cache.set(src, out);
      resolve(out);
    };
    const img = new Image();
    img.onerror = () => resolve(src);
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const px = data.data;

        let minX = c.width;
        let minY = c.height;
        let maxX = -1;
        let maxY = -1;

        // Pass 1 — coverage mask. Works for both shapes of input: an
        // ink-on-transparent capture (alpha carries the stroke) and an old
        // dark-on-white capture (luminance carries it).
        const mask = new Uint8ClampedArray(c.width * c.height);
        for (let p = 0; p < mask.length; p++) {
          const i = p * 4;
          const a = px[i + 3];
          if (a === 0) continue;
          const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
          const coverage = (a / 255) * ((THRESHOLD - Math.min(lum, THRESHOLD)) / THRESHOLD);
          mask[p] = Math.min(255, Math.round(coverage * 255 * BOOST));
        }

        // Pass 2 — dilate. Boosting opacity cannot rescue a stroke that is
        // physically thin: once it shrinks below a pixel the downscale
        // averages it away. Widening the ink first is what actually survives.
        const radius = Math.max(1, Math.round(Math.min(c.width, c.height) / 55));
        const grown = new Uint8ClampedArray(mask.length);
        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            let best = 0;
            const y0 = Math.max(0, y - radius);
            const y1 = Math.min(c.height - 1, y + radius);
            const x0 = Math.max(0, x - radius);
            const x1 = Math.min(c.width - 1, x + radius);
            for (let yy = y0; yy <= y1 && best < 255; yy++) {
              const row = yy * c.width;
              for (let xx = x0; xx <= x1; xx++) {
                const v = mask[row + xx];
                if (v > best) {
                  best = v;
                  if (best === 255) break;
                }
              }
            }
            grown[y * c.width + x] = best;
          }
        }

        for (let y = 0; y < c.height; y++) {
          for (let x = 0; x < c.width; x++) {
            const p = y * c.width + x;
            const i = p * 4;
            const alpha = grown[p];
            px[i] = 0;
            px[i + 1] = 0;
            px[i + 2] = 0;
            px[i + 3] = alpha;
            if (alpha > 10) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < 0) {
          resolve(src);
          return;
        }
        ctx.putImageData(data, 0, 0);

        const sx = Math.max(0, minX - PAD);
        const sy = Math.max(0, minY - PAD);
        const sw = Math.min(c.width - sx, maxX - minX + PAD * 2);
        const sh = Math.min(c.height - sy, maxY - minY + PAD * 2);
        const out = document.createElement('canvas');
        out.width = sw;
        out.height = sh;
        out.getContext('2d')?.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
        done(out.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.src = src;
  });
}

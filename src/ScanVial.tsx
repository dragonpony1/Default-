import { useEffect, useRef, useState } from 'react';
import { noAuto } from './inputProps';

// Point the camera at the kit and the LOT, REF and expiration write
// themselves. Two readers share the camera:
//  - the barcode reader watches live for GS1 codes (DataMatrix, Code 128):
//    (01) product GTIN, (10) lot, (17) expiration, (240) sometimes the REF;
//  - some kits (epidural trays among them) carry no barcode at all, only the
//    printed LOT / REF / EXP box — the "read the printed label" button snaps
//    one frame and reads that text with a bundled OCR engine instead.
//
// Everything happens on this device: both readers are bundled into the app,
// the camera frames are decoded in memory and thrown away, no picture is
// saved, and nothing is sent anywhere — same as every other key tapped into
// the app.

export interface VialScan {
  lot?: string;
  exp?: string;
  ref?: string;
  raw: string;
}

const fmtExp = (v: string): string => {
  const m = v.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!m) return v;
  const [, yy, mm, dd] = m;
  // GS1 dates are YYMMDD with day 00 meaning "end of month".
  return dd === '00' ? `${mm}/20${yy}` : `${mm}/${dd}/20${yy}`;
};

export function parseGS1(input: string): VialScan {
  const raw = input.trim();
  const text = raw.replace(/^\][A-Za-z]\d/, ''); // strip the symbology identifier
  const out: VialScan = { raw };
  const take = (ai: string, v: string) => {
    if (ai === '10') out.lot = v;
    else if (ai === '17') out.exp = fmtExp(v);
    else if (ai === '240') out.ref = v; // an explicit REF beats the GTIN
    else if (ai === '01' && !out.ref) out.ref = v;
  };

  if (/\(\d{2,4}\)/.test(text)) {
    // Human-readable GS1: (01)00380...(10)ABC123(17)270630
    for (const m of text.matchAll(/\((\d{2,4})\)([^(]*)/g)) take(m[1], m[2].trim());
  } else if (/^\d{2}/.test(text)) {
    // Raw AI stream with GS separators between variable-length fields.
    const GS = '\u001d';
    const FIXED: Record<string, number> = { '00': 18, '01': 14, '02': 14, '11': 6, '13': 6, '15': 6, '17': 6 };
    let i = 0;
    while (i < text.length - 1) {
      if (text[i] === GS) { i++; continue; }
      const ai2 = text.slice(i, i + 2);
      const ai3 = text.slice(i, i + 3);
      if (FIXED[ai2] != null) {
        take(ai2, text.slice(i + 2, i + 2 + FIXED[ai2]));
        i += 2 + FIXED[ai2];
        continue;
      }
      let ai = '';
      let start = 0;
      if (ai2 === '10' || ai2 === '21') { ai = ai2; start = i + 2; }
      else if (ai3 === '240') { ai = ai3; start = i + 3; }
      else break; // an AI we don't know — stop rather than garble
      const end = text.indexOf(GS, start);
      take(ai, end === -1 ? text.slice(start) : text.slice(start, end));
      i = end === -1 ? text.length : end + 1;
    }
  }

  // Not GS1 at all: many kit boxes carry a plain code — offer it as the REF.
  if (!out.lot && !out.exp && !out.ref && /^[A-Za-z0-9\-/.]{4,}$/.test(text)) out.ref = text;
  return out;
}

// ---- Reading the PRINTED label (no barcode on the kit) ----

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

interface LabelDate { y: number; m: number; d?: number }

// Every date shape kits actually print: 2027-05-31 / 2027/05, 05-2027,
// 31 MAY 2027 / MAY 2027.
function datesIn(s: string): LabelDate[] {
  const found: LabelDate[] = [];
  for (const m of s.matchAll(/\b(20\d{2})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?\b/g)) {
    const mo = +m[2];
    if (mo >= 1 && mo <= 12) found.push({ y: +m[1], m: mo, d: m[3] ? +m[3] : undefined });
  }
  for (const m of s.matchAll(/\b(\d{1,2})[-/.](20\d{2})\b/g)) {
    const mo = +m[1];
    if (mo >= 1 && mo <= 12) found.push({ y: +m[2], m: mo });
  }
  for (const m of s.matchAll(/\b(?:(\d{1,2})\s+)?([A-Z]{3})[A-Z]*\.?\s*(20\d{2})\b/g)) {
    const mo = MONTHS[m[2]];
    if (mo) found.push({ y: +m[3], m: +mo, d: m[1] ? +m[1] : undefined });
  }
  return found;
}

/** OCR text from the printed box → the REF, LOT and expiration on it.
 *  When no EXP keyword survives the read, the LATEST date on the label is
 *  offered as the expiration (the earlier one is the manufacture date) —
 *  the numbers are shown for checking before they are used, never silently. */
export function parseLabelText(input: string): VialScan {
  const raw = input.trim();
  const up = ` ${raw.toUpperCase().replace(/\s+/g, ' ')} `;
  const out: VialScan = { raw };

  // REF / LOT codes: the word, an optional "NO."/"NUMBER", then the code.
  // A real code carries at least one digit — plain words are never taken.
  const code = (kw: string): string => {
    const m = up.match(new RegExp(`\\b${kw}\\b[.:#]?\\s*(?:NO\\.?|NUMBER|#)?[.:]?\\s*([A-Z0-9][A-Z0-9/-]{2,})`));
    const cap = m ? m[1].replace(/[^A-Z0-9/-]+$/, '') : '';
    return /\d/.test(cap) ? cap : '';
  };
  const ref = code('REF') || code('CAT(?:ALOG)?');
  const lot = code('LOT') || code('BATCH');
  if (ref) out.ref = ref;
  if (lot && lot !== ref) out.lot = lot;

  // Expiration: a date near the EXP keyword wins; otherwise the latest date.
  const kw = up.match(/\b(?:EXP(?:IRY|IRES|IRATION)?|USE BY)\b[.:]?\s*([^]{0,20})/);
  let cand = kw ? datesIn(` ${kw[1]} `) : [];
  if (!cand.length) cand = datesIn(up);
  if (cand.length) {
    cand.sort((a, b) => a.y - b.y || a.m - b.m || (a.d ?? 0) - (b.d ?? 0));
    const x = cand[cand.length - 1];
    const mm = String(x.m).padStart(2, '0');
    out.exp = x.d ? `${mm}/${String(x.d).padStart(2, '0')}/${x.y}` : `${mm}/${x.y}`;
  }
  return out;
}

interface Props {
  onUse: (scan: VialScan) => void;
  onClose: () => void;
}

export default function ScanVial({ onUse, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [found, setFound] = useState<VialScan | null>(null);
  const [status, setStatus] = useState('Starting the camera…');
  const [reading, setReading] = useState(false);
  // Once the OCR has read the label (or the user edits a value), the live
  // barcode reader keeps its hands off the shown numbers.
  const held = useRef(false);
  const ocrWorker = useRef<{ recognize: (i: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> } | null>(null);

  useEffect(() => {
    let stopped = false;
    let stop = () => {};
    (async () => {
      try {
        // Loaded on demand so the pad-and-forms app stays quick to start.
        const { BrowserMultiFormatReader } = await import('@zxing/library');
        const reader = new BrowserMultiFormatReader();
        stop = () => reader.reset();
        if (stopped || !videoRef.current) return;
        setStatus('Point the camera at the barcode — or use the button below when the kit only has the printed LOT/REF/EXP box.');
        await reader.decodeFromVideoDevice(null, videoRef.current, (result) => {
          if (result && !stopped && !held.current) {
            const scan = parseGS1(result.getText());
            setFound((prev) => (prev && prev.raw === scan.raw ? prev : scan));
          }
        });
      } catch {
        setStatus('No camera available — type the numbers instead.');
      }
    })();
    return () => {
      stopped = true;
      stop();
      ocrWorker.current?.terminate();
      ocrWorker.current = null;
    };
  }, []);

  // Snap the current frame and read the printed text on it. The OCR engine
  // and its English model are bundled with the app (public/tess) — the first
  // read spins them up, later reads reuse the running worker.
  const readLabel = async () => {
    const video = videoRef.current;
    if (!video || reading) return;
    if (!video.videoWidth) {
      setStatus('Camera not ready yet — give it a second and tap again.');
      return;
    }
    setReading(true);
    setStatus('Reading the printed label — hold steady…');
    try {
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext('2d')!.drawImage(video, 0, 0);
      if (!ocrWorker.current) {
        const { createWorker } = await import('tesseract.js');
        const base = import.meta.env.BASE_URL;
        ocrWorker.current = (await createWorker('eng', 1, {
          workerPath: `${base}tess/worker.min.js`,
          corePath: `${base}tess`,
          langPath: `${base}tess`,
        })) as unknown as typeof ocrWorker.current;
      }
      const { data } = await ocrWorker.current!.recognize(c);
      const scan = parseLabelText(data.text);
      if (scan.lot || scan.exp || scan.ref) {
        held.current = true;
        setFound(scan);
        setStatus('Check the numbers below and fix any misread before using them.');
      } else {
        setStatus('Could not make out LOT / REF / EXP — fill the frame with the printed box and try again, or type them.');
      }
    } catch {
      setStatus('The label reader failed to start — type the numbers instead.');
    } finally {
      setReading(false);
    }
  };

  // The read numbers are shown in editable boxes: a barcode read is exact,
  // but an OCR read deserves a once-over before it lands on the record.
  const fld = (label: string, k: 'lot' | 'exp' | 'ref') => (
    <label className="scan-fld">
      <span className="b">{label}</span>
      <input
        {...noAuto}
        value={found?.[k] ?? ''}
        onChange={(e) => {
          held.current = true;
          setFound((prev) => ({ ...(prev ?? { raw: '' }), [k]: e.target.value }));
        }}
      />
    </label>
  );

  const usable = found && ((found.lot ?? '').trim() || (found.exp ?? '').trim() || (found.ref ?? '').trim());

  return (
    <div className="sigpad-backdrop" onClick={onClose}>
      <div className="qd-panel scan-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qd-title">📷 Scan the kit</div>
        <video ref={videoRef} className="scan-video" muted playsInline />
        <div className="qd-actions">
          <button type="button" className="chip" disabled={reading} onClick={readLabel}>
            {reading ? '⏳ Reading…' : '📖 No barcode? Read the printed label'}
          </button>
        </div>
        <p className="ihint">{status} Read on this device only — no picture is kept, nothing is sent anywhere.</p>
        {found && (
          <div className="scan-found">
            {fld('Lot', 'lot')}
            {fld('Expiration', 'exp')}
            {fld('REF', 'ref')}
          </div>
        )}
        <div className="qd-actions">
          {usable && (
            <button
              type="button"
              className="chip on qd-give"
              onClick={() => {
                onUse({
                  raw: found.raw,
                  lot: (found.lot ?? '').trim() || undefined,
                  exp: (found.exp ?? '').trim() || undefined,
                  ref: (found.ref ?? '').trim() || undefined,
                });
                onClose();
              }}
            >
              ✓ Use it
            </button>
          )}
          <button type="button" className="chip" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

// Point the camera at the barcode on the spinal kit or vial and the LOT and
// expiration write themselves. Medical packaging barcodes (DataMatrix,
// Code 128, and friends) carry the numbers in GS1 form: (01) the product
// GTIN, (10) the lot, (17) the expiration, (240) sometimes the REF.
//
// Everything happens on this device: the decoding library is bundled into
// the app, the camera frames are decoded in memory and thrown away, no
// picture is saved, and nothing is sent anywhere — same as every other key
// tapped into the app.

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

interface Props {
  onUse: (scan: VialScan) => void;
  onClose: () => void;
}

export default function ScanVial({ onUse, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [found, setFound] = useState<VialScan | null>(null);
  const [status, setStatus] = useState('Starting the camera…');

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
        setStatus('Point the camera at the barcode on the kit.');
        await reader.decodeFromVideoDevice(null, videoRef.current, (result) => {
          if (result && !stopped) {
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
    };
  }, []);

  return (
    <div className="sigpad-backdrop" onClick={onClose}>
      <div className="qd-panel scan-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qd-title">📷 Scan the kit</div>
        <video ref={videoRef} className="scan-video" muted playsInline />
        <p className="ihint">{status} Read on this device only — no picture is kept, nothing is sent anywhere.</p>
        {found && (
          <div className="scan-found">
            {found.lot && <div><span className="b">Lot:</span> {found.lot}</div>}
            {found.exp && <div><span className="b">Expiration:</span> {found.exp}</div>}
            {found.ref && <div><span className="b">REF:</span> {found.ref}</div>}
            {!found.lot && !found.exp && !found.ref && <div>Read a code, but no lot or expiration in it.</div>}
          </div>
        )}
        <div className="qd-actions">
          {found && (found.lot || found.exp || found.ref) && (
            <button type="button" className="chip on qd-give" onClick={() => { onUse(found); onClose(); }}>
              ✓ Use it
            </button>
          )}
          <button type="button" className="chip" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

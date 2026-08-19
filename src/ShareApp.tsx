import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Share the app itself: a QR big enough to scan across a table, the link in
// tap-proof form, and the phone's own share sheet where the browser offers
// one. The link ends in index.html on purpose — messaging apps trim the
// trailing "-/" off the bare address, and the trimmed link 404s.

export default function ShareApp({ onClose }: { onClose: () => void }) {
  const url = `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/index.html`;
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 480 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [url]);

  const canShare = typeof navigator.share === 'function';

  return (
    <div className="sigpad-backdrop" onClick={onClose}>
      <div className="qd-panel share-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qd-title">📤 Share this app</div>
        {qr && <img className="share-qr" src={qr} alt="QR code for the app link" />}
        <p className="ihint share-hint">
          Scan with a phone camera, or send the link. The first open needs internet — after
          that it works fully offline. Free, no login, and no patient data ever leaves the device.
        </p>
        <code className="share-url">{url}</code>
        <div className="qd-actions">
          {canShare && (
            <button
              type="button"
              className="chip on"
              onClick={() => { navigator.share({ title: 'Anesthesia Charting', url }).catch(() => {}); }}
            >
              📤 Share…
            </button>
          )}
          <button
            type="button"
            className="chip"
            onClick={() => { navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => {}); }}
          >
            {copied ? '✓ Copied' : '📋 Copy link'}
          </button>
          <button type="button" className="chip" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

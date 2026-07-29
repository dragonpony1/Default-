import { useSigner, nowStamp } from './signer';
import SigImg from './SigImg';

// A signature line for a form. When the clicked-in provider has a saved
// signature, a "Sign as [II]" button stamps their signature image plus the
// current date and time. The stamped image + date/time print on the form.

interface Props {
  label: string;
  sig: string;
  date: string;
  time: string;
  /** Typed name printed under the signature, so the reader knows whose it is. */
  name?: string;
  onStamp: (sig: string, date: string, time: string, name: string) => void;
  onClear: () => void;
}

export default function SignatureStamp({ label, sig, date, time, name, onStamp, onClear }: Props) {
  const signer = useSigner();

  const sign = () => {
    const { date: d, time: t } = nowStamp();
    onStamp(signer.signature, d, t, signer.name || signer.initials);
  };

  return (
    <div className="sigstamp">
      <div className="sigstamp-line">
        {sig ? <SigImg src={sig} className="sigstamp-img" /> : <span className="sigstamp-blank" />}
      </div>
      <div className="sigstamp-foot">
        <span className="sigstamp-label">{label}{sig && name ? ` — ${name}` : ''}</span>
        <span className="sigstamp-dt">{date}{time ? ` · ${time}` : ''}</span>
      </div>
      <div className="sigstamp-actions screen-only">
        {signer.signature ? (
          <button type="button" className="chip" onClick={sign}>{sig ? '↻ Re-sign' : `✍ Sign as ${signer.initials}`}</button>
        ) : (
          <span className="ihint">Tap a provider with a saved signature to sign</span>
        )}
        {sig && <button type="button" className="chip sigstamp-clear" onClick={onClear} aria-label="Clear signature">✕</button>}
      </div>
    </div>
  );
}

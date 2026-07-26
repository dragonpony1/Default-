import { useSigner, nowStamp } from './signer';

// A signature line for a form. When the clicked-in provider has a saved
// signature, a "Sign as [II]" button stamps their signature image plus the
// current date and time. The stamped image + date/time print on the form.

interface Props {
  label: string;
  sig: string;
  date: string;
  time: string;
  onStamp: (sig: string, date: string, time: string) => void;
  onClear: () => void;
}

export default function SignatureStamp({ label, sig, date, time, onStamp, onClear }: Props) {
  const signer = useSigner();

  const sign = () => {
    const { date: d, time: t } = nowStamp();
    onStamp(signer.signature, d, t);
  };

  return (
    <div className="sigstamp">
      <div className="sigstamp-line">
        {sig ? <img className="sigstamp-img" src={sig} alt="signature" /> : <span className="sigstamp-blank" />}
      </div>
      <div className="sigstamp-foot">
        <span className="sigstamp-label">{label}</span>
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

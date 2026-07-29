import { useState } from 'react';
import { useSigner, nowStamp } from './signer';
import { nameForSignature } from './providers';
import SigImg from './SigImg';
import SignaturePad from './SignaturePad';

// A signature line for a form. The clicked-in provider's saved signature
// stamps in one tap; anyone else draws it here and now — a signature line is
// never a dead end for want of a provider set up with a saved one. The
// stamped image, the signer's typed name and the date/time print on the form.

interface Props {
  label: string;
  sig: string;
  date: string;
  time: string;
  /** Typed name printed with the signature, so a reader knows whose it is. */
  name?: string;
  onStamp: (sig: string, date: string, time: string, name: string) => void;
  onClear: () => void;
}

export default function SignatureStamp({ label, sig, date, time, name, onStamp, onClear }: Props) {
  const signer = useSigner();
  const [pad, setPad] = useState(false);

  const stamp = (image: string) => {
    const { date: d, time: t } = nowStamp();
    onStamp(image, d, t, signer.name || signer.initials);
  };

  const sign = () => {
    if (signer.signature) stamp(signer.signature);
    else setPad(true);
  };

  const shown = nameForSignature(sig, name);

  return (
    <div className="sigstamp">
      {pad && (
        <SignaturePad
          onSave={(image) => {
            stamp(image);
            setPad(false);
          }}
          onCancel={() => setPad(false)}
        />
      )}
      <div className="sigstamp-line">
        {sig ? <SigImg src={sig} className="sigstamp-img" /> : <span className="sigstamp-blank" />}
      </div>
      <div className="sigstamp-foot">
        <span className="sigstamp-label">{label}{sig && shown ? ` — ${shown}` : ''}</span>
        <span className="sigstamp-dt">{date}{time ? ` · ${time}` : ''}</span>
      </div>
      <div className="sigstamp-actions screen-only">
        <button type="button" className="chip" onClick={sign}>
          {sig ? '↻ Re-sign' : signer.signature ? `✍ Sign as ${signer.initials}` : '✍ Sign'}
        </button>
        {sig && <button type="button" className="chip sigstamp-clear" onClick={onClear} aria-label="Clear signature">✕</button>}
      </div>
    </div>
  );
}

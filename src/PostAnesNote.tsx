import { useState } from 'react';
import SigImg from './SigImg';
import { noAuto, numPad, tempPad } from './inputProps';
import { nowStamp, useSigner } from './signer';
import SignaturePad from './SignaturePad';
import type { PreopEval } from './types';

// The Post-Anesthesia Note lives on the printed Pre-Op form, but it is filled
// out in PACU — so this card rides along on the PACU tab and writes straight
// into the pre-op draft. Screen-only: the entries print in their box on the
// pre-op form, exactly where the paper form expects them.

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
}

export default function PostAnesNote({ d, set }: Props) {
  const signer = useSigner();
  const [padOpen, setPadOpen] = useState(false);
  // Written at the end of the case, so it starts folded away — otherwise its
  // sign-off box sits on screen alongside the PACU orders' own.
  const [open, setOpen] = useState(false);

  const [panDate = '', panTime = ''] = (d.panDateTime || '').split(' ');

  const summary = [
    d.panBp && `BP ${d.panBp}`,
    d.panP && `P ${d.panP}`,
    d.panO2 && `O₂ ${d.panO2}`,
    d.panMental,
    d.panSig ? 'signed' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const stamp = (sig: string) => {
    const { date, time } = nowStamp();
    set('panSig', sig);
    set('panDateTime', `${date} ${time}`);
  };

  const num = (label: string, k: keyof PreopEval) => (
    <label className="ifield small" key={String(k)}>
      <span>{label}</span>
      <input {...numPad} value={d[k] as string} onChange={(e) => set(k, e.target.value as PreopEval[typeof k])} />
    </label>
  );

  const temp = (label: string, k: keyof PreopEval) => (
    <label className="ifield small" key={String(k)}>
      <span>{label}</span>
      <input {...tempPad} value={d[k] as string} onChange={(e) => set(k, e.target.value as PreopEval[typeof k])} />
    </label>
  );

  // Hydration is charted as the fluid running and how much of it went in, so
  // it is a fluid choice plus a volume rather than a free-text description.
  // Stored as one string ("LR 1000 mL") because that is what the printed
  // Hydration line carries.
  const fluidPick = (label: string, k: keyof PreopEval, types: string[]) => {
    const cur = (d[k] as string) ?? '';
    const type = types.find((t) => cur.toUpperCase().startsWith(t.toUpperCase())) ?? '';
    const amount = (cur.match(/(\d+)/) ?? [])[1] ?? '';
    const write = (t: string, a: string) =>
      set(k, [t, a ? `${a} mL` : ''].filter(Boolean).join(' ') as PreopEval[typeof k]);
    return (
      <div className="ifield" key={String(k)}>
        <span>{label}</span>
        <div className="chips wrap pan-chips">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip${type === t ? ' on' : ''}`}
              onClick={() => write(type === t ? '' : t, amount)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="pan-amt">
          <input
            {...numPad}
            className="pan-other"
            placeholder="how much"
            value={amount}
            onChange={(e) => write(type, e.target.value.replace(/[^\d]/g, ''))}
          />
          <span className="pan-unit">mL</span>
        </div>
      </div>
    );
  };

  // Assessment fields are the same handful of answers every time — tap one
  // rather than typing it. Tapping again clears; the box still accepts text.
  const pick = (label: string, k: keyof PreopEval, options: string[]) => {
    const cur = d[k] as string;
    return (
      <div className="ifield" key={String(k)}>
        <span>{label}</span>
        <div className="chips wrap pan-chips">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className={`chip${cur === o ? ' on' : ''}`}
              onClick={() => set(k, (cur === o ? '' : o) as PreopEval[typeof k])}
            >
              {o}
            </button>
          ))}
        </div>
        <input
          {...noAuto}
          className="pan-other"
          placeholder="or type…"
          value={options.includes(cur) ? '' : cur}
          onChange={(e) => set(k, e.target.value as PreopEval[typeof k])}
        />
      </div>
    );
  };

  return (
    <section className="icard screen-only">
      <div className="ihead">
        <h2>Post-Anesthesia Note</h2>
        <button type="button" className="chip" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : summary ? 'Open' : 'Fill out'}
        </button>
      </div>
      {!open && <p className="fbf-hint">{summary || 'Not started — prints in the Post-Anesthesia Note box on the pre-op form.'}</p>}
      {open && (
        <>
      <p className="fbf-hint">
        Filled out here in PACU &mdash; it prints in the Post-Anesthesia Note box on the Pre-Op
        form, so the pre-op sheet comes out complete.
      </p>
      <div className="irow">
        {num('BP', 'panBp')}
        {num('P', 'panP')}
        {num('R', 'panR')}
        {temp('T', 'panT')}
        {num('O₂ Sat', 'panO2')}
        {num('Pain (0–10)', 'panPain')}
      </div>
      <div className="irow">
        {pick('N/V', 'panNV', ['None', 'Nausea', 'Vomiting'])}
        {pick('Airway patency', 'panAirway', ['Patent', 'Oral airway', 'Nasal airway', 'Intubated'])}
      </div>
      <div className="irow">
        {pick('Mental status', 'panMental', ['Alert', 'Drowsy', 'Somnolent', 'Unresponsive'])}
        {fluidPick('Hydration', 'panHydration', ['LR', 'D5LR', 'NS'])}
      </div>
      <label className="ifield">
        <span>Notes</span>
        <textarea
          {...noAuto}
          rows={3}
          value={d.panNotes}
          onChange={(e) => set('panNotes', e.target.value)}
        />
      </label>
      <div className="pan-signoff">
        <div className="pan-sigcell">
          <span className="pan-siglabel">Signature</span>
          <div className="pan-sigslot">{d.panSig ? <SigImg src={d.panSig} /> : <span className="pan-blank" />}</div>
          <div className="chips">
            <button
              type="button"
              className="chip on"
              onClick={() => (signer.signature ? stamp(signer.signature) : setPadOpen(true))}
            >
              {d.panSig ? '↻ Re-sign' : signer.signature ? `✍ Sign as ${signer.name || signer.initials}` : '✍ Sign'}
            </button>
            {d.panSig && (
              <button type="button" className="chip" onClick={() => set('panSig', '')}>Clear</button>
            )}
          </div>
        </div>

        <div className="pan-sigcell">
          <span className="pan-siglabel">Date</span>
          <div className="pan-stampval">{panDate || '—'}</div>
          <button type="button" className="chip" onClick={() => set('panDateTime', `${nowStamp().date} ${panTime}`.trim())}>
            📅 Today
          </button>
        </div>

        <div className="pan-sigcell">
          <span className="pan-siglabel">Time</span>
          <div className="pan-stampval">{panTime || '—'}</div>
          <button type="button" className="chip" onClick={() => set('panDateTime', `${panDate || nowStamp().date} ${nowStamp().time}`)}>
            🕐 Now
          </button>
        </div>
      </div>

        </>
      )}
      {padOpen && (
        <SignaturePad
          onSave={(sig) => {
            stamp(sig);
            setPadOpen(false);
          }}
          onCancel={() => setPadOpen(false)}
        />
      )}
    </section>
  );
}

import { useState, type ReactNode } from 'react';
import { noAuto, numPad } from './inputProps';
import WizardShell, { type WizStep } from './WizardShell';
import SigImg from './SigImg';
import { nameForSignature } from './providers';
import SignaturePad from './SignaturePad';
import { nowStamp, useSigner } from './signer';

// Guided walk-through of the PACU (post-anesthesia recovery) orders — fills the
// same draft as the full form. Standing-order doses get common-dose quick-picks;
// a provider's saved defaults pre-fill everything when they click in.

export interface PacuWizApi {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
  setCk: (k: string, v: boolean) => void;
  setTx: (k: string, v: string) => void;
  allergies: string;
  setAllergies: (v: string) => void;
  weight: string;
  weightKg: string;
  height: string;
  setWeight: (v: string) => void;
  setWeightKg: (v: string) => void;
  setHeight: (v: string) => void;
  onBack: () => void;
  onDone: () => void;
}

export default function PacuWizard(api: PacuWizApi) {
  const signer = useSigner();
  const [padOpen, setPadOpen] = useState(false);

  // Signing stamps the signature and both halves of the printed Date/Time in
  // one action; Today and Now set either half on its own.
  const stampSig = (sig: string) => {
    const { date, time } = nowStamp();
    api.setTx('sigImg', sig);
    api.setTx('date', date);
    api.setTx('time', time);
    api.setTx('sigName', signer.name || signer.initials);
  };
  const chip = (active: boolean, onClick: () => void, label: string, key?: string) => (
    <button key={key ?? label} type="button" className={`chip${active ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );

  const field = (label: string, k: string, ph = '') => (
    <label className="ifield" key={k}>
      <span>{label}</span>
      <input {...(['morphineEvery', 'morphineMax', 'dilaudidEvery', 'dilaudidMax', 'fentanylEvery', 'fentanylMax', 'date', 'time'].includes(k) ? numPad : noAuto)} value={api.tx[k] ?? ''} placeholder={ph} onChange={(e) => api.setTx(k, e.target.value)} />
    </label>
  );

  // A dose row: common-dose quick-picks that write a text field, plus free entry.
  const dose = (label: string, k: string, unit: string, doses: (number | string)[], extra?: ReactNode) => (
    <div className="igroup" key={k}>
      <span>{label} {unit && <span className="awiz-unit">{unit}</span>}{extra}</span>
      <div className="chips wrap">
        {doses.map((dv) => chip(api.tx[k] === String(dv), () => api.setTx(k, api.tx[k] === String(dv) ? '' : String(dv)), String(dv), k + dv))}
        <input {...numPad} className="awiz-doseinput" placeholder="other" value={doses.map(String).includes(api.tx[k]) ? '' : (api.tx[k] ?? '')} onChange={(e) => api.setTx(k, e.target.value)} />
      </div>
    </div>
  );

  const priority = (k: string, label: string) => (
    <label className="ck awiz-priority" key={k}>
      <input type="checkbox" checked={!!api.ck[k]} onChange={(e) => api.setCk(k, e.target.checked)} />
      <span>{label} (mark if used)</span>
    </label>
  );

  const steps: WizStep[] = [
    {
      title: 'Patient',
      nav: 'Patient',
      hint: 'Allergies, weight, and height carry over from the pre-op case. Weight drives dosing.',
      render: () => (
        <>
          <label className="ifield" key="allergies">
            <span>Allergies</span>
            <input {...noAuto} value={api.allergies} placeholder="NKDA or list" onChange={(e) => api.setAllergies(e.target.value)} />
          </label>
          <div className="irow">
            <label className="ifield" key="weight">
              <span>Weight (lb)</span>
              <input {...numPad} value={api.weight} onChange={(e) => api.setWeight(e.target.value)} />
            </label>
            <label className="ifield" key="weightKg">
              <span>Weight (kg)</span>
              <input {...numPad} value={api.weightKg} onChange={(e) => api.setWeightKg(e.target.value)} />
            </label>
            <label className="ifield" key="height">
              <span>Height</span>
              <input {...numPad} value={api.height} onChange={(e) => api.setHeight(e.target.value)} />
            </label>
          </div>
        </>
      ),
    },
    {
      title: 'IV / IM pain',
      nav: 'IV pain',
      hint: 'Toradol dose range, or the ibuprofen alternative.',
      render: () => (
        <>
          {dose('Toradol — pain 1–5', 'toradolLow', 'mg', [15, 30])}
          {dose('Toradol — pain 6–10', 'toradolHigh', 'mg', [15, 30])}
          <p className="ihint">~ OR ~ 800 mg Ibuprofen IV in 250 mL NS over 30 min ×1 PRN (item 4 on the form).</p>
        </>
      ),
    },
    {
      title: 'Oral pain',
      nav: 'Oral',
      hint: 'One oral pain medication the PACU nurse may give.',
      render: () => (
        <>
          {dose('Lortab (hydrocodone)', 'lortab', 'mg', [5, 7.5, 10])}
          {dose('Percocet (oxycodone)', 'percocet', 'mg', [5, 7.5, 10])}
        </>
      ),
    },
    {
      title: 'Breakthrough pain',
      nav: 'Breakthrough',
      hint: 'If choosing more than one, mark the priority for each.',
      render: () => (
        <>
          <div className="awiz-drugblock">
            {priority('morphine', 'Morphine (Duramorph)')}
            <div className="irow">
              {dose('Pain 3–5', 'morphineLow', 'mg', [1, 2])}
              {dose('Pain 6–10', 'morphineHigh', 'mg', [2, 4])}
              {field('Every (min)', 'morphineEvery')}
              {field('Max', 'morphineMax')}
            </div>
          </div>
          <div className="awiz-drugblock">
            {priority('dilaudid', 'Dilaudid (Hydromorphone)')}
            <div className="irow">
              {dose('Pain 3–5', 'dilaudidLow', 'mg', [0.2, 0.5])}
              {dose('Pain 6–10', 'dilaudidHigh', 'mg', [0.5, 1])}
              {field('Every (min)', 'dilaudidEvery')}
              {field('Max', 'dilaudidMax')}
            </div>
          </div>
          <div className="awiz-drugblock">
            {priority('fentanyl', 'Fentanyl (Sublimaze)')}
            <div className="irow">
              {dose('Pain 3–5', 'fentanylLow', 'mcg', [25, 50])}
              {dose('Pain 6–10', 'fentanylHigh', 'mcg', [50, 100])}
              {field('Every (min)', 'fentanylEvery')}
              {field('Max', 'fentanylMax')}
            </div>
          </div>
        </>
      ),
    },
    {
      title: 'Nausea & shivering',
      nav: 'Nausea',
      render: () => (
        <>
          {dose('Zofran (ondansetron)', 'zofran', 'mg', [4])}
          {dose('Reglan (metoclopramide)', 'reglan', 'mg', [10])}
          {dose('Demerol (meperidine) — shivering', 'demerol', 'mg', [12.5, 25])}
        </>
      ),
    },
    {
      title: 'Sign-off',
      nav: 'Sign-off',
      hint: 'Sign and it stamps the date and time with it.',
      render: () => (
        <>
          <div className="pan-signoff">
            <div className="pan-sigcell">
              <span className="pan-siglabel">Signature</span>
              <div className="pan-sigslot">
                {api.tx.sigImg ? <SigImg src={api.tx.sigImg} /> : <span className="pan-blank" />}
                {api.tx.sigImg && nameForSignature(api.tx.sigImg, api.tx.sigName) && (
                  <span className="signame">{nameForSignature(api.tx.sigImg, api.tx.sigName)}</span>
                )}
              </div>
              <div className="chips">
                <button
                  type="button"
                  className="chip on"
                  onClick={() => (signer.signature ? stampSig(signer.signature) : setPadOpen(true))}
                >
                  {api.tx.sigImg ? '↻ Re-sign' : signer.signature ? `✍ Sign as ${signer.name || signer.initials}` : '✍ Sign'}
                </button>
                {api.tx.sigImg && (
                  <button type="button" className="chip" onClick={() => { api.setTx('sigImg', ''); api.setTx('sigName', ''); }}>Clear</button>
                )}
              </div>
            </div>

            <div className="pan-sigcell">
              <span className="pan-siglabel">Date</span>
              <div className="pan-stampval">{api.tx.date || '—'}</div>
              <button type="button" className="chip" onClick={() => api.setTx('date', nowStamp().date)}>📅 Today</button>
            </div>

            <div className="pan-sigcell">
              <span className="pan-siglabel">Time</span>
              <div className="pan-stampval">{api.tx.time || '—'}</div>
              <button type="button" className="chip" onClick={() => api.setTx('time', nowStamp().time)}>🕐 Now</button>
            </div>
          </div>
          {padOpen && (
            <SignaturePad
              onSave={(sig) => {
                stampSig(sig);
                setPadOpen(false);
              }}
              onCancel={() => setPadOpen(false)}
            />
          )}
        </>
      ),
    },
  ];

  return <WizardShell steps={steps} onBack={api.onBack} onDone={api.onDone} />;
}

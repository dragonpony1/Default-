import { useState, type ReactNode } from 'react';
import { datePad, noAuto, numPad, timePad } from './inputProps';
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

  // The rank chips write the same keys the form's circled words do — one rank
  // per drug, one drug per rank (picking 1st for fentanyl lets 1st go on the
  // others). Tapping a held rank releases it.
  const RANK_SHOW: Record<string, string> = { first: '1st', second: '2nd', third: '3rd' };
  const PAIN_GROUP = ['morphine', 'dilaudid', 'fentanyl'];
  const NAUSEA_GROUP = ['zofran', 'reglan', 'inapsine'];
  const rank = (k: string, group: string[], words: string[]) => (
    <span className="chips awiz-rank" key={`${k}Rank`}>
      <span className="awiz-unit">give</span>
      {words.map((w) =>
        chip(
          !!api.ck[`${k}Pri${w}`],
          () => {
            const on = !api.ck[`${k}Pri${w}`];
            for (const o of words) api.setCk(`${k}Pri${o}`, false);
            for (const g of group) api.setCk(`${g}Pri${w}`, false);
            if (on) api.setCk(`${k}Pri${w}`, true);
          },
          RANK_SHOW[w],
          k + w,
        ),
      )}
    </span>
  );

  const priority = (k: string, label: string) => (
    <div className="awiz-priline" key={k}>
      <label className="ck awiz-priority">
        <input type="checkbox" checked={!!api.ck[k]} onChange={(e) => api.setCk(k, e.target.checked)} />
        <span>{label} (mark if used)</span>
      </label>
      {rank(k, PAIN_GROUP, ['first', 'second', 'third'])}
    </div>
  );

  const order = (k: string, label: string) => (
    <label className="ck awiz-order" key={k}>
      <input type="checkbox" checked={!!api.ck[k]} onChange={(e) => api.setCk(k, e.target.checked)} />
      <span>{label}</span>
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
      title: 'Standing orders',
      nav: 'Orders',
      hint: 'Circle the blanket orders that apply — these have no dose to set.',
      render: () => (
        <div className="awiz-orders">
          {order('circle2', '2 · Post-anesthesia oxygen / narcotic-hold parameters (A–G)')}
          {order('circle13', '13 · Call/contact anesthesia criteria (a–g)')}
          {order('circle14', '14 · Discharge when MWMC PACU criteria met')}
          {order('circle15', '15 · Incentive spirometer if alert and room-air SaO₂ < 90%')}
        </div>
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
      hint: 'If choosing more than one, tell the PACU nurse the order: tap 1st / 2nd / 3rd on each — it circles the word on the printed line.',
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
      title: 'Nausea',
      nav: 'Nausea',
      hint: 'If ordering more than one, tap 1st / 2nd to circle which the nurse tries first.',
      render: () => (
        <>
          {dose('Zofran (ondansetron)', 'zofran', 'mg', [4], rank('zofran', NAUSEA_GROUP, ['first', 'second']))}
          {dose('Reglan (metoclopramide)', 'reglan', 'mg', [10], rank('reglan', NAUSEA_GROUP, ['first', 'second']))}
          {dose('Inapsine (droperidol)', 'inapsine', 'mg', [0.625, 1.25], rank('inapsine', NAUSEA_GROUP, ['first', 'second']))}
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

            {/* Stamped by signing, but tappable too: the boxes summon the
                date and time pads (each with its own Today / Now key), so a
                sign-off written down late can carry the true clock time. */}
            <div className="pan-sigcell">
              <span className="pan-siglabel">Date</span>
              <input {...datePad} className="pan-stampval" value={api.tx.date ?? ''} placeholder="—" onChange={(e) => api.setTx('date', e.target.value)} />
              <button type="button" className="chip" onClick={() => api.setTx('date', nowStamp().date)}>📅 Today</button>
            </div>

            <div className="pan-sigcell">
              <span className="pan-siglabel">Time</span>
              <input {...timePad} className="pan-stampval" value={api.tx.time ?? ''} placeholder="—" onChange={(e) => api.setTx('time', e.target.value)} />
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

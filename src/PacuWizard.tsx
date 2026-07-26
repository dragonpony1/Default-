import { type ReactNode } from 'react';
import { noAuto } from './inputProps';
import WizardShell, { type WizStep } from './WizardShell';

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
  onBack: () => void;
  onDone: () => void;
}

export default function PacuWizard(api: PacuWizApi) {
  const chip = (active: boolean, onClick: () => void, label: string, key?: string) => (
    <button key={key ?? label} type="button" className={`chip${active ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );

  const field = (label: string, k: string, ph = '') => (
    <label className="ifield" key={k}>
      <span>{label}</span>
      <input {...noAuto} value={api.tx[k] ?? ''} placeholder={ph} onChange={(e) => api.setTx(k, e.target.value)} />
    </label>
  );

  // A dose row: common-dose quick-picks that write a text field, plus free entry.
  const dose = (label: string, k: string, unit: string, doses: (number | string)[], extra?: ReactNode) => (
    <div className="igroup" key={k}>
      <span>{label} {unit && <span className="awiz-unit">{unit}</span>}{extra}</span>
      <div className="chips wrap">
        {doses.map((dv) => chip(api.tx[k] === String(dv), () => api.setTx(k, api.tx[k] === String(dv) ? '' : String(dv)), String(dv), k + dv))}
        <input {...noAuto} className="awiz-doseinput" inputMode="decimal" placeholder="other" value={doses.map(String).includes(api.tx[k]) ? '' : (api.tx[k] ?? '')} onChange={(e) => api.setTx(k, e.target.value)} />
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
      hint: 'Allergies carry over from the pre-op case. Weight drives dosing.',
      render: () => (
        <>
          <label className="ifield" key="allergies">
            <span>Allergies</span>
            <input {...noAuto} value={api.allergies} placeholder="NKDA or list" onChange={(e) => api.setAllergies(e.target.value)} />
          </label>
          <div className="irow">
            {field('Weight (lb)', 'weight')}
            {field('Weight (kg)', 'weightKg')}
            {field('Height', 'height')}
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
      render: () => (
        <div className="irow">
          {field('Anesthesia provider', 'provider')}
          {field('Date', 'date', 'MM/DD/YY')}
          {field('Time', 'time', 'HHMM')}
        </div>
      ),
    },
  ];

  return <WizardShell steps={steps} onBack={api.onBack} onDone={api.onDone} />;
}

import { useState } from 'react';
import { noAuto, numPad } from './inputProps';
import WizardShell, { type WizStep } from './WizardShell';
import { PROCEDURE_CODES, BLOCK_CODES } from './BillingSheet';

// Guided walk-through of the Deseret Peak billing sheet — fills the same draft
// as the full form. Case info first, then a type-to-find CPT code picker,
// modifiers, and regional blocks / lines. No patient identifiers.

export interface BillingWizApi {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
  setCk: (k: string, v: boolean) => void;
  setTx: (k: string, v: string) => void;
  onBack: () => void;
  onDone: () => void;
}

export default function BillingWizard(api: BillingWizApi) {
  const [q, setQ] = useState('');

  const field = (label: string, k: string, ph = '', cls = '') => (
    <label className={`ifield ${cls}`} key={k}>
      <span>{label}</span>
      <input {...(['dateM', 'dateD', 'dateY', 'startTime', 'endTime', 'addCode'].includes(k) ? numPad : noAuto)} value={api.tx[k] ?? ''} placeholder={ph} onChange={(e) => api.setTx(k, e.target.value)} />
    </label>
  );

  const codeToggle = ([code, desc]: [string, string]) => (
    <button
      key={code}
      type="button"
      className={`awiz-coderow${api.ck[code] ? ' on' : ''}`}
      onClick={() => api.setCk(code, !api.ck[code])}
    >
      <span className="awiz-code">{code}</span>
      <span className="awiz-codedesc">{desc}</span>
    </button>
  );

  const modChip = (k: string, label: string) => (
    <button key={k} type="button" className={`chip${api.ck[k] ? ' on' : ''}`} onClick={() => api.setCk(k, !api.ck[k])}>
      {label}
    </button>
  );

  const needle = q.trim().toLowerCase();
  const matches = needle
    ? PROCEDURE_CODES.filter(([c, d]) => c.toLowerCase().includes(needle) || d.toLowerCase().includes(needle))
    : [];
  const selected = PROCEDURE_CODES.filter(([c]) => api.ck[c]);

  const steps: WizStep[] = [
    {
      title: 'Case info',
      nav: 'Case',
      hint: 'Date, procedure, surgeon, and times for the anesthesia bill.',
      render: () => (
        <>
          <div className="irow">
            {field('Date (MM)', 'dateM', 'MM', 'small')}
            {field('DD', 'dateD', 'DD', 'small')}
            {field('YY', 'dateY', 'YY', 'small')}
          </div>
          {field('Procedure', 'procedure')}
          <div className="irow">
            {field('Surgeon', 'surgeon')}
            {field('Dx', 'dx')}
          </div>
          <div className="irow">
            {field('CRNA', 'crna')}
            {field('Start time', 'startTime', 'HHMM')}
            {field('End time', 'endTime', 'HHMM')}
          </div>
        </>
      ),
    },
    {
      title: 'Procedure code',
      nav: 'Code',
      hint: 'Type the procedure or a CPT number, then tap to select. Selected codes show below.',
      render: () => (
        <>
          <label className="ifield" key="search">
            <span>Find a CPT code</span>
            <input {...noAuto} value={q} placeholder="e.g. knee, hernia, colonoscopy, 00840" onChange={(e) => setQ(e.target.value)} />
          </label>
          {needle && (
            <div className="awiz-codelist">
              {matches.length ? matches.map(codeToggle) : <p className="ihint">No codes match “{q}”. You can add one on the full form.</p>}
            </div>
          )}
          <div className="igroup">
            <span>Selected</span>
            {selected.length ? (
              <div className="awiz-codelist">{selected.map(codeToggle)}</div>
            ) : (
              <p className="ihint">Nothing selected yet.</p>
            )}
          </div>
          {field('Add a code not on the form', 'addCode', 'CPT')}
        </>
      ),
    },
    {
      title: 'Modifiers',
      nav: 'Modifiers',
      hint: 'Anything that changes the units billed.',
      render: () => (
        <div className="chips wrap">
          {modChip('ageLt1', 'Age <1')}
          {modChip('ageGt70', 'Age >70')}
          {modChip('asa3', 'ASA 3')}
          {modChip('asa4', 'ASA 4')}
          {modChip('prone', 'Prone')}
          {modChip('turned45', 'Turned ≥45° from anesthesia')}
        </div>
      ),
    },
    {
      title: 'Blocks & lines',
      nav: 'Blocks',
      hint: 'Regional blocks, ultrasound, lines, and after-hours codes.',
      render: () => <div className="awiz-codelist">{BLOCK_CODES.map(codeToggle)}</div>,
    },
  ];

  return <WizardShell steps={steps} onBack={api.onBack} onDone={api.onDone} />;
}

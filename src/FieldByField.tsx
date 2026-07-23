import { useState, type ReactNode } from 'react';
import type { PreopEval, YesNo } from './types';
import { SYSTEMS, type SystemBand } from './formConfig';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  onFinish: () => void;
}

type StringKeys = { [K in keyof PreopEval]: PreopEval[K] extends string ? K : never }[keyof PreopEval];
type BoolKeys = { [K in keyof PreopEval]: PreopEval[K] extends boolean ? K : never }[keyof PreopEval];

const STEP_KEY = 'preop-fbf-step';

export default function FieldByField({ d, set, onFinish }: Props) {
  const [step, setStep] = useState(() => {
    const saved = Number(localStorage.getItem(STEP_KEY));
    return Number.isInteger(saved) && saved >= 0 ? saved : 0;
  });

  const go = (n: number) => {
    localStorage.setItem(STEP_KEY, String(n));
    setStep(n);
  };

  const chip = (active: boolean, onClick: () => void, label: string, key?: string) => (
    <button key={key ?? label} type="button" className={`chip${active ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );

  const boolChip = (k: BoolKeys, label: string) => chip(d[k], () => set(k, !d[k]), label);

  const oneOf = <K extends 'sex' | 'heightUnit' | 'weightUnit' | 'physicalStatus' | 'mallampati'>(
    k: K,
    values: readonly string[],
  ) => (
    <div className="chips">
      {values.map((v) =>
        chip(d[k] === v, () => set(k, (d[k] === v ? '' : v) as PreopEval[K]), v, v),
      )}
    </div>
  );

  const ynChips = (k: 'tobacco' | 'ethanol' | 'streetDrug') => (
    <div className="chips">
      {(['yes', 'no'] as YesNo[]).map((v) =>
        chip(d[k] === v, () => set(k, d[k] === v ? '' : v), v === 'yes' ? 'Yes' : 'No', v),
      )}
    </div>
  );

  const input = (k: StringKeys, placeholder = '') => (
    <input
      className="fbf-input"
      value={d[k]}
      placeholder={placeholder}
      onChange={(e) => set(k, e.target.value)}
    />
  );

  const area = (k: StringKeys, disabled = false) => (
    <textarea
      className="fbf-input"
      rows={3}
      value={d[k]}
      disabled={disabled}
      onChange={(e) => set(k, e.target.value)}
    />
  );

  interface Step {
    title: string;
    hint?: string;
    render: () => ReactNode;
  }

  const textStep = (title: string, k: StringKeys, hint?: string): Step => ({
    title,
    hint,
    render: () => input(k),
  });

  const noneableStep = (title: string, textKey: StringKeys, noneKey: BoolKeys): Step => ({
    title,
    render: () => (
      <>
        {area(textKey, d[noneKey])}
        {boolChip(noneKey, 'None')}
      </>
    ),
  });

  const systemStep = (s: SystemBand): Step => {
    const items = s.col1.concat(s.col2 ?? []);
    return {
      title: s.title,
      hint: 'Tap every condition that applies, or WNL if the system is normal.',
      render: () => (
        <>
          <div className="chips wrap">
            {chip(!!d.wnl[s.key], () => set('wnl', { ...d.wnl, [s.key]: !d.wnl[s.key] }), 'WNL')}
            {items.map((label) => {
              const id = `${s.key}:${label}`;
              return chip(
                !!d.checks[id],
                () => set('checks', { ...d.checks, [id]: !d.checks[id] }),
                label,
                id,
              );
            })}
          </div>
          {items
            .filter((label) => d.checks[`${s.key}:${label}`])
            .map((label) => {
              const id = `${s.key}:${label}`;
              return (
                <label className="ifield detail" key={id}>
                  <span>{label} &mdash; details</span>
                  <input
                    value={d.checkDetails[id] ?? ''}
                    placeholder="onset, severity, treatment&hellip;"
                    onChange={(e) => set('checkDetails', { ...d.checkDetails, [id]: e.target.value })}
                  />
                </label>
              );
            })}
          <label className="ifield">
            <span>Comments</span>
            <textarea
              rows={2}
              value={d.comments[s.key] ?? ''}
              onChange={(e) => set('comments', { ...d.comments, [s.key]: e.target.value })}
            />
          </label>
        </>
      ),
    };
  };

  const bySystem = Object.fromEntries(SYSTEMS.map((s) => [s.key, s]));

  const steps: Step[] = [
    textStep('Age', 'age'),
    { title: 'Sex', render: () => oneOf('sex', ['M', 'F']) },
    {
      title: 'Height',
      render: () => (
        <>
          {input('height')}
          {oneOf('heightUnit', ['in', 'cm'])}
        </>
      ),
    },
    {
      title: 'Weight',
      render: () => (
        <>
          {input('weight')}
          {oneOf('weightUnit', ['lb', 'kg'])}
        </>
      ),
    },
    textStep('Proposed procedure', 'proposedProcedure'),
    textStep('Blood pressure', 'bp', 'Pre-procedure vital signs'),
    textStep('Pulse', 'p', 'Pre-procedure vital signs'),
    textStep('Respirations', 'r', 'Pre-procedure vital signs'),
    textStep('Temperature', 't', 'Pre-procedure vital signs'),
    textStep('NPO since', 'npo'),
    noneableStep('Previous anesthesia / operations', 'previousAnesthesia', 'previousAnesthesiaNone'),
    noneableStep('Current medications', 'currentMedications', 'currentMedicationsNone'),
    noneableStep('Family history of anesthesia complications', 'familyHistory', 'familyHistoryNone'),
    noneableStep('Allergies', 'allergies', 'allergiesNone'),
    {
      title: 'History from',
      hint: 'Tap all that apply.',
      render: () => (
        <div className="chips wrap">
          {boolChip('hfPatient', 'Patient')}
          {boolChip('hfParentGuardian', 'Parent / Guardian')}
          {boolChip('hfSignificantOther', 'Significant Other')}
          {boolChip('hfChart', 'Chart')}
          {boolChip('hfCommLanguage', 'Communication / Language Problems')}
          {boolChip('hfPoorHistorian', 'Poor Historian')}
        </div>
      ),
    },
    { title: 'Mallampati class', render: () => oneOf('mallampati', ['I', 'II', 'III', 'IV']) },
    textStep('TMD', 'tmd', 'Airway / teeth / head and neck'),
    textStep('ROM', 'rom', 'Airway / teeth / head and neck'),
    systemStep(bySystem.resp),
    {
      title: 'Tobacco use',
      render: () => (
        <>
          {ynChips('tobacco')}
          {d.tobacco === 'yes' && (
            <>
              <label className="ifield">
                <span>Packs / day</span>
                <input value={d.tobaccoPacksDay} onChange={(e) => set('tobaccoPacksDay', e.target.value)} />
              </label>
              <label className="ifield">
                <span>For how many years</span>
                <input value={d.tobaccoYears} onChange={(e) => set('tobaccoYears', e.target.value)} />
              </label>
            </>
          )}
        </>
      ),
    },
    systemStep(bySystem.cardio),
    systemStep(bySystem.gi),
    {
      title: 'Ethanol use',
      render: () => (
        <>
          {ynChips('ethanol')}
          {d.ethanol === 'yes' && (
            <label className="ifield">
              <span>Frequency</span>
              <input value={d.ethanolFreq} onChange={(e) => set('ethanolFreq', e.target.value)} />
            </label>
          )}
        </>
      ),
    },
    {
      title: '“Street drug” use',
      render: () => (
        <>
          {ynChips('streetDrug')}
          {d.streetDrug === 'yes' && (
            <label className="ifield">
              <span>Frequency</span>
              <input value={d.streetDrugFreq} onChange={(e) => set('streetDrugFreq', e.target.value)} />
            </label>
          )}
        </>
      ),
    },
    systemStep(bySystem.neuro),
    systemStep(bySystem.renal),
    systemStep(bySystem.other),
    {
      title: 'Diagnostic studies',
      render: () => (
        <>
          {boolChip('dxNone', 'No diagnostic studies')}
          {!d.dxNone && (
            <>
              <label className="ifield"><span>EKG</span>{input('dxEkg')}</label>
              <label className="ifield"><span>Chest X-Ray</span>{input('dxCxr')}</label>
              <label className="ifield"><span>Pulmonary studies</span>{input('dxPulm')}</label>
              <label className="ifield"><span>Other diagnostics</span>{input('dxOther')}</label>
            </>
          )}
        </>
      ),
    },
    {
      title: 'Laboratory studies',
      render: () => (
        <>
          <label className="ifield"><span>Hgb / Hct / CBC</span>{input('labHgb')}</label>
          <label className="ifield"><span>Electrolytes</span>{input('labElectrolytes')}</label>
          <label className="ifield"><span>Urinalysis</span>{input('labUrinalysis')}</label>
          <label className="ifield"><span>Other labs</span>{input('labOther')}</label>
        </>
      ),
    },
    {
      title: 'Physical status (ASA)',
      render: () => (
        <>
          {oneOf('physicalStatus', ['1', '2', '3', '4', '5'])}
          {boolChip('physicalStatusE', 'E (Emergency)')}
        </>
      ),
    },
    { title: 'Problem list / diagnoses', render: () => area('problemList') },
    { title: 'Planned anesthesia / special monitors', render: () => area('plannedAnesthesia') },
    { title: 'Pre-anesthesia medications ordered', render: () => area('preAnesthesiaMeds') },
    textStep('Evaluation date/time', 'evalDateTime'),
  ];

  const done = step >= steps.length;
  const cur = done ? null : steps[step];

  return (
    <div className="fbf screen-only">
      <div className="fbf-progress">
        <div className="fbf-bar">
          <div className="fbf-fill" style={{ width: `${(Math.min(step, steps.length) / steps.length) * 100}%` }} />
        </div>
        <span className="fbf-count">
          {done ? 'Done' : `${step + 1} of ${steps.length}`}
        </span>
      </div>

      {cur ? (
        <section className="icard fbf-card">
          {cur.hint && <p className="fbf-hint">{cur.hint}</p>}
          <h2>{cur.title}</h2>
          {cur.render()}
        </section>
      ) : (
        <section className="icard fbf-card">
          <h2>All questions answered</h2>
          <p className="fbf-hint">
            Review the paper form, then print it. Remember: apply the patient label sticker after
            printing and clear the form.
          </p>
          <button type="button" className="fbf-next" onClick={onFinish}>
            View paper form
          </button>
        </section>
      )}

      <div className="fbf-nav">
        <button type="button" className="fbf-back" disabled={step === 0} onClick={() => go(step - 1)}>
          &larr; Back
        </button>
        {!done && (
          <button type="button" className="fbf-next" onClick={() => go(step + 1)}>
            {step === steps.length - 1 ? 'Finish' : 'Next →'}
          </button>
        )}
        {done && (
          <button type="button" className="fbf-back" onClick={() => go(0)}>
            Start over
          </button>
        )}
      </div>
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import type { PreopEval, YesNo } from './types';
import { SYSTEMS, type SystemBand } from './formConfig';
import AddEntry from './AddEntry';

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

  const detailField = (id: string, label: string) => (
    <label className="ifield detail" key={id}>
      <span>{label} &mdash; details</span>
      <input
        value={d.checkDetails[id] ?? ''}
        placeholder="onset, severity, treatment&hellip;"
        onChange={(e) => set('checkDetails', { ...d.checkDetails, [id]: e.target.value })}
      />
    </label>
  );

  const addCustom = (sysKey: string, label: string) => {
    const existing = d.customConditions[sysKey] ?? [];
    if (existing.includes(label)) return;
    set('customConditions', { ...d.customConditions, [sysKey]: [...existing, label] });
  };

  const removeCustom = (sysKey: string, label: string) => {
    const rest = { ...d.checkDetails };
    delete rest[`${sysKey}:${label}`];
    set('checkDetails', rest);
    set('customConditions', {
      ...d.customConditions,
      [sysKey]: (d.customConditions[sysKey] ?? []).filter((l) => l !== label),
    });
  };

  interface Step {
    title: string;
    hint?: string;
    render: () => ReactNode;
    summary: () => string;
  }

  const textStep = (title: string, k: StringKeys, hint?: string): Step => ({
    title,
    hint,
    render: () => input(k),
    summary: () => d[k],
  });

  const noneableStep = (title: string, textKey: StringKeys, noneKey: BoolKeys): Step => ({
    title,
    render: () => (
      <>
        {area(textKey, d[noneKey])}
        {boolChip(noneKey, 'None')}
      </>
    ),
    summary: () => (d[noneKey] ? 'None' : d[textKey]),
  });

  const systemStep = (s: SystemBand): Step => {
    const items = s.col1.concat(s.col2 ?? []);
    return {
      title: s.title,
      hint: 'Tap every condition that applies, or WNL if the system is normal. Type anything not listed below.',
      render: () => {
        const custom = d.customConditions[s.key] ?? [];
        return (
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
              {custom.map((label) =>
                chip(true, () => removeCustom(s.key, label), `${label} ✕`, `custom:${label}`),
              )}
            </div>
            <AddEntry onAdd={(label) => addCustom(s.key, label)} />
            {items
              .filter((label) => d.checks[`${s.key}:${label}`])
              .map((label) => detailField(`${s.key}:${label}`, label))}
            {custom.map((label) => detailField(`${s.key}:${label}`, label))}
            <label className="ifield">
              <span>Comments</span>
              <textarea
                rows={2}
                value={d.comments[s.key] ?? ''}
                onChange={(e) => set('comments', { ...d.comments, [s.key]: e.target.value })}
              />
            </label>
          </>
        );
      },
      summary: () => {
        const parts: string[] = [];
        if (d.wnl[s.key]) parts.push('WNL');
        parts.push(...items.filter((l) => d.checks[`${s.key}:${l}`]));
        parts.push(...(d.customConditions[s.key] ?? []));
        if (d.comments[s.key]) parts.push(d.comments[s.key]);
        return parts.join(', ');
      },
    };
  };

  const bySystem = Object.fromEntries(SYSTEMS.map((s) => [s.key, s]));

  const joinNonEmpty = (pairs: Array<[string, string]>) =>
    pairs.filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`).join('; ');

  const steps: Step[] = [
    textStep('Age', 'age'),
    { title: 'Sex', render: () => oneOf('sex', ['M', 'F']), summary: () => d.sex },
    {
      title: 'Height',
      render: () => (
        <>
          {input('height')}
          {oneOf('heightUnit', ['in', 'cm'])}
        </>
      ),
      summary: () => (d.height ? `${d.height} ${d.heightUnit}`.trim() : ''),
    },
    {
      title: 'Weight',
      render: () => (
        <>
          {input('weight')}
          {oneOf('weightUnit', ['lb', 'kg'])}
        </>
      ),
      summary: () => (d.weight ? `${d.weight} ${d.weightUnit}`.trim() : ''),
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
      summary: () =>
        (
          [
            [d.hfPatient, 'Patient'],
            [d.hfParentGuardian, 'Parent / Guardian'],
            [d.hfSignificantOther, 'Significant Other'],
            [d.hfChart, 'Chart'],
            [d.hfCommLanguage, 'Communication / Language Problems'],
            [d.hfPoorHistorian, 'Poor Historian'],
          ] as Array<[boolean, string]>
        )
          .filter(([on]) => on)
          .map(([, l]) => l)
          .join(', '),
    },
    {
      title: 'Mallampati class',
      render: () => oneOf('mallampati', ['I', 'II', 'III', 'IV']),
      summary: () => d.mallampati,
    },
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
      summary: () =>
        d.tobacco === 'yes'
          ? `Yes${d.tobaccoPacksDay ? `, ${d.tobaccoPacksDay} packs/day` : ''}${d.tobaccoYears ? `, ${d.tobaccoYears} years` : ''}`
          : d.tobacco === 'no'
            ? 'No'
            : '',
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
      summary: () =>
        d.ethanol === 'yes' ? `Yes${d.ethanolFreq ? `, ${d.ethanolFreq}` : ''}` : d.ethanol === 'no' ? 'No' : '',
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
      summary: () =>
        d.streetDrug === 'yes'
          ? `Yes${d.streetDrugFreq ? `, ${d.streetDrugFreq}` : ''}`
          : d.streetDrug === 'no'
            ? 'No'
            : '',
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
      summary: () =>
        d.dxNone
          ? 'None'
          : joinNonEmpty([
              ['EKG', d.dxEkg],
              ['CXR', d.dxCxr],
              ['Pulmonary', d.dxPulm],
              ['Other', d.dxOther],
            ]),
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
      summary: () =>
        joinNonEmpty([
          ['Hgb/Hct/CBC', d.labHgb],
          ['Electrolytes', d.labElectrolytes],
          ['Urinalysis', d.labUrinalysis],
          ['Other', d.labOther],
        ]),
    },
    {
      title: 'Physical status (ASA)',
      render: () => (
        <>
          {oneOf('physicalStatus', ['1', '2', '3', '4', '5'])}
          {boolChip('physicalStatusE', 'E (Emergency)')}
        </>
      ),
      summary: () => `${d.physicalStatus}${d.physicalStatusE ? 'E' : ''}`,
    },
    { title: 'Problem list / diagnoses', render: () => area('problemList'), summary: () => d.problemList },
    {
      title: 'Planned anesthesia / special monitors',
      render: () => area('plannedAnesthesia'),
      summary: () => d.plannedAnesthesia,
    },
    {
      title: 'Pre-anesthesia medications ordered',
      render: () => area('preAnesthesiaMeds'),
      summary: () => d.preAnesthesiaMeds,
    },
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
        <span className="fbf-count">{done ? 'Review' : `${step + 1} of ${steps.length}`}</span>
        {!done && (
          <button type="button" className="chip" onClick={() => go(steps.length)}>
            Review all
          </button>
        )}
      </div>

      {cur ? (
        <section className="icard fbf-card">
          {cur.hint && <p className="fbf-hint">{cur.hint}</p>}
          <h2>{cur.title}</h2>
          {cur.render()}
        </section>
      ) : (
        <section className="icard fbf-card">
          <h2>Review every field</h2>
          <p className="fbf-hint">
            Tap any field to open it and edit or add to the entry. When everything looks right, view
            the paper form and print it.
          </p>
          <div className="fbf-review">
            {steps.map((s, i) => {
              const v = s.summary();
              return (
                <button type="button" className="fbf-revrow" key={s.title + i} onClick={() => go(i)}>
                  <span className="fbf-revlabel">{s.title}</span>
                  <span className={`fbf-revvalue${v ? '' : ' empty'}`}>{v || '— blank —'}</span>
                </button>
              );
            })}
          </div>
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
      </div>
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import { noAuto, numPad, tempPad } from './inputProps';
import type { PreopEval, YesNo } from './types';
import { SYSTEMS, selectedProblems, screenItems, type SystemBand } from './formConfig';
import type { CustomChoices } from './choices';
import AddEntry from './AddEntry';
import DateTimeField from './DateTimeField';
import ProcedurePicker from './ProcedurePicker';
import MedList from './MedList';
import AllergyList from './AllergyList';
import PrevHxList from './PrevHxList';
import AnesthesiaPicker from './AnesthesiaPicker';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  customChoices: CustomChoices;
  onFinish: () => void;
}

type StringKeys = { [K in keyof PreopEval]: PreopEval[K] extends string ? K : never }[keyof PreopEval];
type BoolKeys = { [K in keyof PreopEval]: PreopEval[K] extends boolean ? K : never }[keyof PreopEval];

const STEP_KEY = 'preop-fbf-step';

export default function FieldByField({ d, set, customChoices, onFinish }: Props) {
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
        {...noAuto}
      className="fbf-input"
      value={d[k]}
      placeholder={placeholder}
      onChange={(e) => set(k, e.target.value)}
    />
  );

  const numInput = (k: StringKeys, placeholder = '') => (
    <input
      {...numPad}
      className="fbf-input"
      value={d[k]}
      placeholder={placeholder}
      onChange={(e) => set(k, e.target.value)}
    />
  );

  const tempInput = (k: StringKeys) => (
    <input
      {...tempPad}
      className="fbf-input"
      value={d[k]}
      onChange={(e) => set(k, e.target.value)}
    />
  );

  const area = (k: StringKeys, disabled = false) => (
    <textarea
        {...noAuto}
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
        {...noAuto}
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

  const choiceStep = (title: string, k: StringKeys, options: string[], hint?: string): Step => ({
    title,
    hint,
    render: () => (
      <>
        <div className="chips wrap">
          {options.map((v) => chip(d[k] === v, () => set(k, d[k] === v ? '' : v), v, v))}
        </div>
        <label className="ifield"><span>or type</span>{input(k)}</label>
      </>
    ),
    summary: () => d[k],
  });

  const textStep = (title: string, k: StringKeys, hint?: string): Step => ({
    title,
    hint,
    render: () => input(k),
    summary: () => d[k],
  });

  const numStep = (title: string, k: StringKeys, hint?: string): Step => ({
    title,
    hint,
    render: () => numInput(k),
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
    const items = screenItems(s).concat(customChoices[s.key] ?? []);
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
        {...noAuto}
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
    {
      title: 'Proposed procedure',
      hint: 'Pick the service, tap the procedure — or type it. Manage the lists on the Edit Choices tab.',
      render: () => (
        <>
          <ProcedurePicker d={d} set={set} customChoices={customChoices} />
          {input('proposedProcedure')}
        </>
      ),
      summary: () => d.proposedProcedure,
    },
    numStep('Age', 'age'),
    { title: 'Sex', render: () => oneOf('sex', ['M', 'F']), summary: () => d.sex },
    {
      title: 'Height',
      render: () => (
        <>
          {numInput('height')}
          {oneOf('heightUnit', ['in', 'cm'])}
        </>
      ),
      summary: () => (d.height ? `${d.height} ${d.heightUnit}`.trim() : ''),
    },
    {
      title: 'Weight',
      render: () => (
        <>
          {numInput('weight')}
          {oneOf('weightUnit', ['lb', 'kg'])}
        </>
      ),
      summary: () => (d.weight ? `${d.weight} ${d.weightUnit}`.trim() : ''),
    },
    numStep('Blood pressure', 'bp', 'Pre-procedure vital signs'),
    numStep('Pulse', 'p', 'Pre-procedure vital signs'),
    numStep('Respirations', 'r', 'Pre-procedure vital signs'),
    { title: 'Temperature', hint: 'Pre-procedure vital signs', render: () => tempInput('t'), summary: () => d.t },
    textStep('NPO since', 'npo'),
    {
      title: 'Previous anesthesia / operations',
      hint: 'Type to search — surgeries and anesthesia events. Airway, MH, and PONV history get flagged.',
      render: () => (
        <>
          <PrevHxList d={d} set={set} customChoices={customChoices} />
          <div className="chips">
            {boolChip('previousAnesthesiaNone', 'None')}
          </div>
          <label className="ifield">
            <span>Other history / notes</span>
            <textarea
              {...noAuto}
              rows={2}
              value={d.previousAnesthesia}
              disabled={d.previousAnesthesiaNone}
              onChange={(e) => set('previousAnesthesia', e.target.value)}
            />
          </label>
        </>
      ),
      summary: () =>
        d.previousAnesthesiaNone
          ? 'None'
          : [
              ...d.prevHxList.map((x) => (x.detail ? `${x.name} (${x.detail})` : x.name)),
              d.previousAnesthesia,
            ]
              .filter(Boolean)
              .join(', '),
    },
    {
      title: 'Current medications',
      hint: 'Type to search — tap a suggestion to add it. Anticoagulants, GLP-1s, and insulin ask for the last dose.',
      render: () => (
        <>
          <MedList d={d} set={set} customChoices={customChoices} />
          <div className="chips">
            {boolChip('currentMedicationsNone', 'None')}
          </div>
          <label className="ifield">
            <span>Other meds / notes</span>
            <textarea
              {...noAuto}
              rows={2}
              value={d.currentMedications}
              disabled={d.currentMedicationsNone}
              onChange={(e) => set('currentMedications', e.target.value)}
            />
          </label>
        </>
      ),
      summary: () =>
        d.currentMedicationsNone
          ? 'None'
          : [
              ...d.meds.map((x) => (x.dose ? `${x.name} ${x.dose}` : x.name)),
              d.currentMedications,
            ]
              .filter(Boolean)
              .join(', '),
    },
    noneableStep('Family history of anesthesia complications', 'familyHistory', 'familyHistoryNone'),
    {
      title: 'Allergies',
      hint: 'Type to search — tap a suggestion to add it, then note the reaction. OR-critical allergens are flagged.',
      render: () => (
        <>
          <AllergyList d={d} set={set} customChoices={customChoices} />
          <div className="chips">
            {boolChip('allergiesNone', 'None')}
          </div>
          <label className="ifield">
            <span>Other allergies / notes</span>
            <textarea
              {...noAuto}
              rows={2}
              value={d.allergies}
              disabled={d.allergiesNone}
              onChange={(e) => set('allergies', e.target.value)}
            />
          </label>
        </>
      ),
      summary: () =>
        d.allergiesNone
          ? 'None'
          : [
              ...d.allergyList.map((x) => (x.reaction ? `${x.name} (${x.reaction})` : x.name)),
              d.allergies,
            ]
              .filter(Boolean)
              .join(', '),
    },
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
    choiceStep('TMD', 'tmd', ['2', '3', '4'], 'Airway / teeth / head and neck — fingerbreadths'),
    choiceStep('ROM', 'rom', ['Full', 'Limited'], 'Airway / teeth / head and neck — neck range of motion'),
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
                <input {...numPad} value={d.tobaccoPacksDay} onChange={(e) => set('tobaccoPacksDay', e.target.value)} />
              </label>
              <label className="ifield">
                <span>For how many years</span>
                <input {...numPad} value={d.tobaccoYears} onChange={(e) => set('tobaccoYears', e.target.value)} />
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
    {
      title: 'Home O₂',
      hint: 'Oxygen use at home.',
      render: () => (
        <>
          <div className="chips">
            {chip(d.homeO2 === 'night', () => set('homeO2', d.homeO2 === 'night' ? '' : 'night'), 'At night')}
            {chip(d.homeO2 === '24/7', () => set('homeO2', d.homeO2 === '24/7' ? '' : '24/7'), '24/7')}
          </div>
          {d.homeO2 && (
            <label className="ifield">
              <span>Liters / min</span>
              <input {...numPad} value={d.homeO2Liters} onChange={(e) => set('homeO2Liters', e.target.value)} />
            </label>
          )}
        </>
      ),
      summary: () =>
        d.homeO2
          ? `${d.homeO2 === 'night' ? 'At night' : '24/7'}${d.homeO2Liters ? `, ${d.homeO2Liters} L/min` : ''}`
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
              <input {...noAuto} value={d.ethanolFreq} onChange={(e) => set('ethanolFreq', e.target.value)} />
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
              <input {...noAuto} value={d.streetDrugFreq} onChange={(e) => set('streetDrugFreq', e.target.value)} />
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
    {
      title: 'Problem list / diagnoses',
      hint: 'Everything you checked in the systems review is carried here automatically and prints on the form. Use the box only for anything extra.',
      render: () => (
        <>
          {selectedProblems(d.checks, d.customConditions).length > 0 && (
            <div className="chips wrap">
              {selectedProblems(d.checks, d.customConditions).map((l) => (
                <span className="chip fixed" key={l}>{l}</span>
              ))}
            </div>
          )}
          {area('problemList')}
        </>
      ),
      summary: () => {
        const probs = selectedProblems(d.checks, d.customConditions);
        return [probs.join(', '), d.problemList].filter(Boolean).join('; ');
      },
    },
    {
      title: 'Planned anesthesia / special monitors',
      hint: 'Tap to combine — selections join with "+". Edit the text for anything else.',
      render: () => (
        <>
          <AnesthesiaPicker d={d} set={set} customChoices={customChoices} />
          {area('plannedAnesthesia')}
        </>
      ),
      summary: () => d.plannedAnesthesia,
    },
    {
      title: 'Pre-anesthesia medications ordered',
      render: () => area('preAnesthesiaMeds'),
      summary: () => d.preAnesthesiaMeds,
    },
    {
      title: 'Evaluation date/time',
      hint: 'Tap Now to stamp the current date and time, or spin the wheels.',
      render: () => <DateTimeField value={d.evalDateTime} onChange={(v) => set('evalDateTime', v)} />,
      summary: () => d.evalDateTime,
    },
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
          <>
            {step > 0 && (
              <button type="button" className="chip" onClick={() => go(0)}>
                Restart
              </button>
            )}
            <button type="button" className="chip" onClick={() => go(steps.length)}>
              Review all
            </button>
          </>
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

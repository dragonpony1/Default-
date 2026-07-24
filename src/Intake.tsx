import { useState, type ReactNode } from 'react';
import { noAuto } from './inputProps';
import type { PreopEval, YesNo } from './types';
import { SYSTEMS, screenItems } from './formConfig';
import type { CustomChoices } from './choices';
import AddEntry from './AddEntry';
import ProcedurePicker from './ProcedurePicker';
import MedList from './MedList';
import AllergyList from './AllergyList';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  customChoices: CustomChoices;
}

type StringKeys = { [K in keyof PreopEval]: PreopEval[K] extends string ? K : never }[keyof PreopEval];
type BoolKeys = { [K in keyof PreopEval]: PreopEval[K] extends boolean ? K : never }[keyof PreopEval];

export default function Intake({ d, set, customChoices }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ patient: true });

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  const setAll = (v: boolean) => {
    const ids = ['patient', 'history', 'airway', ...SYSTEMS.map((s) => s.key), 'studies', 'plan'];
    setOpen(Object.fromEntries(ids.map((id) => [id, v])));
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

  const field = (label: string, k: StringKeys, opts: { small?: boolean; placeholder?: string } = {}) => (
    <label className={`ifield${opts.small ? ' small' : ''}`}>
      <span>{label}</span>
      <input {...noAuto} value={d[k]} placeholder={opts.placeholder ?? ''} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  const areaField = (label: string, k: StringKeys, rows = 2) => (
    <label className="ifield">
      <span>{label}</span>
      <textarea {...noAuto} rows={rows} value={d[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  const noneable = (label: string, textKey: StringKeys, noneKey: BoolKeys) => (
    <div className="noneable">
      <label className="ifield">
        <span>{label}</span>
        <textarea
        {...noAuto}
          rows={2}
          value={d[textKey]}
          disabled={d[noneKey]}
          onChange={(e) => set(textKey, e.target.value)}
        />
      </label>
      {boolChip(noneKey, 'None')}
    </div>
  );

  // Collapsible section: the header shows a one-line summary of what has
  // been entered so the whole intake reads as a checklist when collapsed.
  const sec = (id: string, title: string, summary: string, children: ReactNode) => (
    <section className={`icard isec${open[id] ? ' open' : ''}`} key={id}>
      <button type="button" className="isec-head" onClick={() => toggle(id)}>
        <span className="isec-arrow">{open[id] ? '▾' : '▸'}</span>
        <span className="isec-title">{title}</span>
        <span className={`isec-summary${summary ? '' : ' empty'}`}>{summary || '— blank —'}</span>
      </button>
      {open[id] && <div className="isec-body">{children}</div>}
    </section>
  );

  const joinBits = (bits: Array<string | false | undefined>) => bits.filter(Boolean).join(', ');

  const noneableSummary = (label: string, textKey: StringKeys, noneKey: BoolKeys) =>
    d[noneKey] ? `${label}: none` : d[textKey] ? `${label}: ${d[textKey]}` : '';

  const patientSummary = joinBits([
    d.proposedProcedure,
    d.age && `${d.age} y`,
    d.sex,
    d.height && `${d.height} ${d.heightUnit}`.trim(),
    d.weight && `${d.weight} ${d.weightUnit}`.trim(),
    d.bp && `BP ${d.bp}`,
    d.npo && `NPO ${d.npo}`,
  ]);

  const medsSummary = d.currentMedicationsNone
    ? 'Meds: none'
    : d.meds.length || d.currentMedications
      ? `Meds: ${[...d.meds.map((x) => x.name), d.currentMedications].filter(Boolean).join(', ')}`
      : '';

  const allergySummary = d.allergiesNone
    ? 'Allergies: none'
    : d.allergyList.length || d.allergies
      ? `Allergies: ${[...d.allergyList.map((x) => x.name), d.allergies].filter(Boolean).join(', ')}`
      : '';

  const historySummary = joinBits([
    noneableSummary('Anesth hx', 'previousAnesthesia', 'previousAnesthesiaNone'),
    medsSummary,
    noneableSummary('Fam hx', 'familyHistory', 'familyHistoryNone'),
    allergySummary,
  ]);

  const airwaySummary = joinBits([
    d.mallampati && `Mallampati ${d.mallampati}`,
    d.tmd && `TMD ${d.tmd}`,
    d.rom && `ROM ${d.rom}`,
  ]);

  const systemSummary = (key: string, items: string[]) =>
    joinBits([
      d.wnl[key] && 'WNL',
      ...items.filter((l) => d.checks[`${key}:${l}`]),
      ...(d.customConditions[key] ?? []),
      key === 'resp' && d.tobacco === 'yes' && 'tobacco',
      key === 'resp' && d.homeO2 && 'home O₂',
      key === 'gi' && d.ethanol === 'yes' && 'ethanol',
      key === 'gi' && d.streetDrug === 'yes' && 'street drugs',
      d.comments[key],
    ]);

  const studiesSummary = d.dxNone
    ? joinBits(['no diagnostics', d.labHgb, d.labElectrolytes, d.labUrinalysis, d.labOther])
    : joinBits([d.dxEkg, d.dxCxr, d.dxPulm, d.dxOther, d.labHgb, d.labElectrolytes, d.labUrinalysis, d.labOther]);

  const planSummary = joinBits([
    d.physicalStatus && `ASA ${d.physicalStatus}${d.physicalStatusE ? 'E' : ''}`,
    d.problemList,
    d.plannedAnesthesia,
  ]);

  return (
    <div className="intake screen-only">
      <div className="isec-controls">
        <button type="button" className="chip" onClick={() => setAll(true)}>Expand all</button>
        <button type="button" className="chip" onClick={() => setAll(false)}>Collapse all</button>
      </div>

      {sec('patient', 'Patient & Procedure', patientSummary, (
        <>
          <ProcedurePicker d={d} set={set} customChoices={customChoices} />
          {field('Proposed procedure', 'proposedProcedure')}
          <div className="irow">
            {field('Age', 'age', { small: true })}
            <div className="igroup"><span>Sex</span>{oneOf('sex', ['M', 'F'])}</div>
            <div className="igroup">
              {field('Height', 'height', { small: true })}
              {oneOf('heightUnit', ['in', 'cm'])}
            </div>
            <div className="igroup">
              {field('Weight', 'weight', { small: true })}
              {oneOf('weightUnit', ['lb', 'kg'])}
            </div>
          </div>
          <div className="irow">
            {field('BP', 'bp', { small: true })}
            {field('P', 'p', { small: true })}
            {field('R', 'r', { small: true })}
            {field('T', 't', { small: true })}
            {field('NPO since', 'npo', { small: true })}
          </div>
        </>
      ))}

      {sec('history', 'History', historySummary, (
        <>
          {noneable('Previous anesthesia / operations', 'previousAnesthesia', 'previousAnesthesiaNone')}
          <div className="igroup">
            <span>Current medications</span>
            <MedList d={d} set={set} customChoices={customChoices} />
          </div>
          {noneable('Other meds / notes', 'currentMedications', 'currentMedicationsNone')}
          {noneable('Family history of anesthesia complications', 'familyHistory', 'familyHistoryNone')}
          <div className="igroup">
            <span>Allergies</span>
            <AllergyList d={d} set={set} customChoices={customChoices} />
          </div>
          {noneable('Other allergies / notes', 'allergies', 'allergiesNone')}
          <div className="igroup">
            <span>History from</span>
            <div className="chips wrap">
              {boolChip('hfPatient', 'Patient')}
              {boolChip('hfParentGuardian', 'Parent / Guardian')}
              {boolChip('hfSignificantOther', 'Significant Other')}
              {boolChip('hfChart', 'Chart')}
              {boolChip('hfCommLanguage', 'Communication / Language Problems')}
              {boolChip('hfPoorHistorian', 'Poor Historian')}
            </div>
          </div>
        </>
      ))}

      {sec('airway', 'Airway / Teeth / Head and Neck', airwaySummary, (
        <>
          <div className="igroup"><span>Mallampati class</span>{oneOf('mallampati', ['I', 'II', 'III', 'IV'])}</div>
          <div className="irow">
            {field('TMD', 'tmd', { small: true })}
            {field('ROM', 'rom', { small: true })}
          </div>
        </>
      ))}

      {SYSTEMS.map((s) => {
        const items = screenItems(s).concat(customChoices[s.key] ?? []);
        const custom = d.customConditions[s.key] ?? [];
        const removeCustom = (label: string) => {
          const rest = { ...d.checkDetails };
          delete rest[`${s.key}:${label}`];
          set('checkDetails', rest);
          set('customConditions', {
            ...d.customConditions,
            [s.key]: custom.filter((l) => l !== label),
          });
        };
        const detailField = (label: string) => {
          const id = `${s.key}:${label}`;
          return (
            <label className="ifield detail" key={id}>
              <span>{label} — details</span>
              <input
        {...noAuto}
                value={d.checkDetails[id] ?? ''}
                placeholder="onset, severity, treatment…"
                onChange={(e) => set('checkDetails', { ...d.checkDetails, [id]: e.target.value })}
              />
            </label>
          );
        };
        return sec(s.key, s.title, systemSummary(s.key, items), (
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
              {custom.map((label) => chip(true, () => removeCustom(label), `${label} ✕`, `custom:${label}`))}
            </div>
            <AddEntry onAdd={(label) => {
              if (!custom.includes(label)) {
                set('customConditions', { ...d.customConditions, [s.key]: [...custom, label] });
              }
            }} />
            {items.filter((label) => d.checks[`${s.key}:${label}`]).map(detailField)}
            {custom.map(detailField)}
            {s.key === 'resp' && (
              <>
                <div className="irow social">
                  <div className="igroup"><span>Tobacco use</span>{ynChips('tobacco')}</div>
                  {d.tobacco === 'yes' && (
                    <>
                      {field('Packs / day', 'tobaccoPacksDay', { small: true })}
                      {field('For how many years', 'tobaccoYears', { small: true })}
                    </>
                  )}
                </div>
                <div className="irow social">
                  <div className="igroup">
                    <span>Home O&#8322;</span>
                    <div className="chips">
                      {chip(d.homeO2 === 'night', () => set('homeO2', d.homeO2 === 'night' ? '' : 'night'), 'At night')}
                      {chip(d.homeO2 === '24/7', () => set('homeO2', d.homeO2 === '24/7' ? '' : '24/7'), '24/7')}
                    </div>
                  </div>
                  {d.homeO2 && field('Liters / min', 'homeO2Liters', { small: true })}
                </div>
              </>
            )}
            {s.key === 'gi' && (
              <>
                <div className="irow social">
                  <div className="igroup"><span>Ethanol use</span>{ynChips('ethanol')}</div>
                  {d.ethanol === 'yes' && field('Frequency', 'ethanolFreq', { small: true })}
                </div>
                <div className="irow social">
                  <div className="igroup"><span>&ldquo;Street drug&rdquo; use</span>{ynChips('streetDrug')}</div>
                  {d.streetDrug === 'yes' && field('Frequency', 'streetDrugFreq', { small: true })}
                </div>
              </>
            )}
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
        ));
      })}

      {sec('studies', 'Diagnostics & Laboratory Studies', studiesSummary, (
        <>
          {boolChip('dxNone', 'No diagnostic studies')}
          <div className="two">
            {areaField('EKG', 'dxEkg', 1)}
            {areaField('Chest X-Ray', 'dxCxr', 1)}
            {areaField('Pulmonary studies', 'dxPulm', 1)}
            {areaField('Other diagnostics', 'dxOther', 1)}
            {areaField('Hgb / Hct / CBC', 'labHgb', 1)}
            {areaField('Electrolytes', 'labElectrolytes', 1)}
            {areaField('Urinalysis', 'labUrinalysis', 1)}
            {areaField('Other labs', 'labOther', 1)}
          </div>
        </>
      ))}

      {sec('plan', 'Assessment & Plan', planSummary, (
        <>
          <div className="irow">
            <div className="igroup"><span>Physical status (ASA)</span>{oneOf('physicalStatus', ['1', '2', '3', '4', '5'])}</div>
            {boolChip('physicalStatusE', 'E (Emergency)')}
          </div>
          {areaField('Problem list / diagnoses', 'problemList')}
          {areaField('Planned anesthesia / special monitors', 'plannedAnesthesia')}
          {areaField('Pre-anesthesia medications ordered', 'preAnesthesiaMeds')}
          {field('Evaluation date/time', 'evalDateTime', { small: true })}
          <p className="ihint">
            The post-anesthesia and inpatient note sections are completed on the printed form after the case.
          </p>
        </>
      ))}
    </div>
  );
}

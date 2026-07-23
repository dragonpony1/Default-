import type { PreopEval, YesNo } from './types';
import { SYSTEMS } from './formConfig';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
}

type StringKeys = { [K in keyof PreopEval]: PreopEval[K] extends string ? K : never }[keyof PreopEval];
type BoolKeys = { [K in keyof PreopEval]: PreopEval[K] extends boolean ? K : never }[keyof PreopEval];

export default function Intake({ d, set }: Props) {
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
      <input value={d[k]} placeholder={opts.placeholder ?? ''} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  const areaField = (label: string, k: StringKeys, rows = 2) => (
    <label className="ifield">
      <span>{label}</span>
      <textarea rows={rows} value={d[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  const noneable = (label: string, textKey: StringKeys, noneKey: BoolKeys) => (
    <div className="noneable">
      <label className="ifield">
        <span>{label}</span>
        <textarea
          rows={2}
          value={d[textKey]}
          disabled={d[noneKey]}
          onChange={(e) => set(textKey, e.target.value)}
        />
      </label>
      {boolChip(noneKey, 'None')}
    </div>
  );

  return (
    <div className="intake screen-only">
      <section className="icard">
        <h2>Patient &amp; Procedure</h2>
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
        {field('Proposed procedure', 'proposedProcedure')}
        <div className="irow">
          {field('BP', 'bp', { small: true })}
          {field('P', 'p', { small: true })}
          {field('R', 'r', { small: true })}
          {field('T', 't', { small: true })}
          {field('NPO since', 'npo', { small: true })}
        </div>
      </section>

      <section className="icard">
        <h2>History</h2>
        {noneable('Previous anesthesia / operations', 'previousAnesthesia', 'previousAnesthesiaNone')}
        {noneable('Current medications', 'currentMedications', 'currentMedicationsNone')}
        {noneable('Family history of anesthesia complications', 'familyHistory', 'familyHistoryNone')}
        {noneable('Allergies', 'allergies', 'allergiesNone')}
        <div className="igroup">
          <span>History from</span>
          <div className="chips">
            {boolChip('hfPatient', 'Patient')}
            {boolChip('hfParentGuardian', 'Parent / Guardian')}
            {boolChip('hfSignificantOther', 'Significant Other')}
            {boolChip('hfChart', 'Chart')}
            {boolChip('hfCommLanguage', 'Communication / Language Problems')}
            {boolChip('hfPoorHistorian', 'Poor Historian')}
          </div>
        </div>
      </section>

      <section className="icard">
        <h2>Airway / Teeth / Head and Neck</h2>
        <div className="igroup"><span>Mallampati class</span>{oneOf('mallampati', ['I', 'II', 'III', 'IV'])}</div>
        <div className="irow">
          {field('TMD', 'tmd', { small: true })}
          {field('ROM', 'rom', { small: true })}
        </div>
      </section>

      {SYSTEMS.map((s) => {
        const items = s.col1.concat(s.col2 ?? []);
        return (
          <section className="icard" key={s.key}>
            <div className="ihead">
              <h2>{s.title}</h2>
              {chip(!!d.wnl[s.key], () => set('wnl', { ...d.wnl, [s.key]: !d.wnl[s.key] }), 'WNL')}
            </div>
            <div className="chips wrap">
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
                    <span>{label} — details</span>
                    <input
                      value={d.checkDetails[id] ?? ''}
                      placeholder="onset, severity, treatment…"
                      onChange={(e) => set('checkDetails', { ...d.checkDetails, [id]: e.target.value })}
                    />
                  </label>
                );
              })}
            {s.key === 'resp' && (
              <div className="irow social">
                <div className="igroup"><span>Tobacco use</span>{ynChips('tobacco')}</div>
                {d.tobacco === 'yes' && (
                  <>
                    {field('Packs / day', 'tobaccoPacksDay', { small: true })}
                    {field('For how many years', 'tobaccoYears', { small: true })}
                  </>
                )}
              </div>
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
                rows={2}
                value={d.comments[s.key] ?? ''}
                onChange={(e) => set('comments', { ...d.comments, [s.key]: e.target.value })}
              />
            </label>
          </section>
        );
      })}

      <section className="icard">
        <h2>Diagnostics &amp; Laboratory Studies</h2>
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
      </section>

      <section className="icard">
        <h2>Assessment &amp; Plan</h2>
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
      </section>
    </div>
  );
}

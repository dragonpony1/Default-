import { useEffect, useRef, useState } from 'react';
import { noAuto } from './inputProps';
import { emptyPreopEval, type PreopEval, type YesNo } from './types';
import { SYSTEMS, type SystemBand } from './formConfig';
import { clearDraft, loadDraft, saveDraft } from './storage';
import Barcode39 from './Barcode39';
import FieldByField from './FieldByField';
import EditChoices from './EditChoices';
import AnesRecord, { clearAnesDraft } from './AnesRecord';
import PacuOrders, { clearPacuDraft } from './PacuOrders';
import BillingSheet, { clearBillingDraft } from './BillingSheet';
import { loadCustomChoices, saveCustomChoices, type CustomChoices } from './choices';

type StringKeys = { [K in keyof PreopEval]: PreopEval[K] extends string ? K : never }[keyof PreopEval];
type BoolKeys = { [K in keyof PreopEval]: PreopEval[K] extends boolean ? K : never }[keyof PreopEval];

export default function App() {
  const [d, setD] = useState<PreopEval>(loadDraft);
  const [view, setView] = useState<'fields' | 'form' | 'anes' | 'pacu' | 'billing' | 'choices'>('fields');
  const [anesReset, setAnesReset] = useState(0);
  const [choices, setChoicesState] = useState<CustomChoices>(loadCustomChoices);

  const setChoices = (c: CustomChoices) => {
    saveCustomChoices(c);
    setChoicesState(c);
  };

  useEffect(() => {
    saveDraft(d);
  }, [d]);

  const set = <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => setD((prev) => ({ ...prev, [k]: v }));

  // Two-tap clear: first tap arms the button (auto-disarms after 5s), a second
  // tap within that window shows a final confirm before wiping. Guards against
  // an accidental single tap mid-case.
  const [clearArmed, setClearArmed] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarmClear = () => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = null;
    setClearArmed(false);
  };

  const handleClear = () => {
    if (!clearArmed) {
      setClearArmed(true);
      clearTimer.current = setTimeout(() => setClearArmed(false), 5000);
      return;
    }
    disarmClear();
    if (window.confirm('Clear ALL forms and wipe all entered data from this device? This cannot be undone.')) {
      clearDraft();
      clearAnesDraft();
      clearPacuDraft();
      clearBillingDraft();
      setD({ ...emptyPreopEval });
      setAnesReset((n) => n + 1);
    }
  };

  // Borderless inline text input
  const txt = (k: StringKeys, cls = '') => (
    <input {...noAuto} className={`t ${cls}`} value={d[k]} onChange={(e) => set(k, e.target.value)} />
  );

  const ta = (k: StringKeys, rows = 2, cls = '') => (
    <textarea {...noAuto} className={`a ${cls}`} rows={rows} value={d[k]} onChange={(e) => set(k, e.target.value)} />
  );

  // Plain boolean checkbox
  const bx = (k: BoolKeys, label?: string) => (
    <label className="ck">
      <input type="checkbox" checked={d[k]} onChange={(e) => set(k, e.target.checked)} />
      {label && <span>{label}</span>}
    </label>
  );

  // Mutually-exclusive checkbox group (paper-style: check one, re-click to clear)
  const xbx = <K extends 'sex' | 'heightUnit' | 'weightUnit' | 'physicalStatus'>(
    k: K,
    v: PreopEval[K],
    label: string,
  ) => (
    <label className="ck">
      <input
        type="checkbox"
        checked={d[k] === v}
        onChange={(e) => set(k, (e.target.checked ? v : '') as PreopEval[K])}
      />
      <span>{label}</span>
    </label>
  );

  const yn = (k: 'tobacco' | 'ethanol' | 'streetDrug') => (
    <>
      {(['yes', 'no'] as YesNo[]).map((v) => (
        <label className="ck" key={v}>
          <input
        type="checkbox"
            checked={d[k] === v}
            onChange={(e) => set(k, e.target.checked ? v : '')}
          />
          <span>{v === 'yes' ? 'Yes' : 'No'}</span>
        </label>
      ))}
    </>
  );

  // Condition checkbox inside a system band. The printed OSA/CPAP box stays
  // combined; on-screen entry records OSA and CPAP separately, and either
  // one checks the combined box.
  const cond = (band: string, label: string) => {
    const id = `${band}:${label}`;
    const derived =
      label === 'OSA/CPAP' && (!!d.checks[`${band}:OSA`] || !!d.checks[`${band}:CPAP`]);
    return (
      <label className="ck" key={id}>
        <input
        type="checkbox"
          checked={!!d.checks[id] || derived}
          onChange={(e) => set('checks', { ...d.checks, [id]: e.target.checked })}
        />
        <span>{label}</span>
      </label>
    );
  };

  const bandComments = (key: string, rows: number) => (
    <textarea
        {...noAuto}
      className="a"
      rows={rows}
      value={d.comments[key] ?? ''}
      onChange={(e) => set('comments', { ...d.comments, [key]: e.target.value })}
    />
  );

  const band = (s: SystemBand, extra?: React.ReactNode, commentRows = 3) => (
    <div className="row band" key={s.key}>
      <div className="cell sys">
        <div className="syshead">{s.title}</div>
        <div className="list2">
          <div className="list">{s.col1.map((l) => cond(s.key, l))}</div>
          {s.col2 && <div className="list">{s.col2.map((l) => cond(s.key, l))}</div>}
        </div>
      </div>
      <div className="cell wnlc">
        <input
        type="checkbox"
          checked={!!d.wnl[s.key]}
          onChange={(e) => set('wnl', { ...d.wnl, [s.key]: e.target.checked })}
        />
      </div>
      <div className="cell com grow">
        {extra}
        {s.col1
          .concat(s.col2 ?? [])
          .filter((l) => d.checks[`${s.key}:${l}`] && d.checkDetails[`${s.key}:${l}`])
          .map((l) => (
            <div className="detline" key={l}>
              <span className="b">{l}:</span> {d.checkDetails[`${s.key}:${l}`]}
            </div>
          ))}
        {(s.key === 'resp' ? ['OSA', 'CPAP'].filter((l) => d.checks[`resp:${l}`]) : [])
          .concat(
            (choices[s.key] ?? []).filter((l) => d.checks[`${s.key}:${l}`]),
            d.customConditions[s.key] ?? [],
          )
          .map((l) => (
            <div className="detline" key={`custom:${l}`}>
              <span className="b">{l}{d.checkDetails[`${s.key}:${l}`] ? ':' : ''}</span>{' '}
              {d.checkDetails[`${s.key}:${l}`] ?? ''}
            </div>
          ))}
        {bandComments(s.key, commentRows)}
      </div>
    </div>
  );

  const rslot = (label: string, k: StringKeys, rows = 2) => (
    <div className="rslot">
      <span className="rlabel">{label}</span>
      {ta(k, rows)}
    </div>
  );

  const vitalsPair = (
    pre: 'pan' | 'inp',
  ) => (
    <div className="pan2">
      <div className="pcol">
        <div className="vrow"><span>BP</span>{txt(`${pre}Bp` as StringKeys)}</div>
        <div className="vrow"><span>P</span>{txt(`${pre}P` as StringKeys)}</div>
        <div className="vrow"><span>R</span>{txt(`${pre}R` as StringKeys)}</div>
        <div className="vrow"><span>T</span>{txt(`${pre}T` as StringKeys)}</div>
        <div className="vrow"><span>O&#8322; Sat.</span>{txt(`${pre}O2` as StringKeys)}</div>
        <div className="vrow"><span>Pain (0&ndash;10)</span>{txt(`${pre}Pain` as StringKeys)}</div>
      </div>
      <div className="pcol">
        <div className="vrow"><span>N/V</span>{txt(`${pre}NV` as StringKeys)}</div>
        <div className="vrow u"><span>Airway Patency</span>{txt(`${pre}Airway` as StringKeys)}</div>
        <div className="vrow u"><span>Mental Status</span>{txt(`${pre}Mental` as StringKeys)}</div>
        {pre === 'pan' && <div className="vrow u"><span>Hydration</span>{txt('panHydration')}</div>}
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="toolbar screen-only">
        <h1>Pre-Anesthesia Evaluation</h1>
        <div className="tabs">
          <button className={view === 'fields' ? 'on' : ''} onClick={() => setView('fields')}>
            Pre-Op Wizard
          </button>
          <button className={view === 'form' ? 'on' : ''} onClick={() => setView('form')}>
            Paper Form
          </button>
          <button className={view === 'anes' ? 'on' : ''} onClick={() => setView('anes')}>
            Anesthesia Record
          </button>
          <button className={view === 'pacu' ? 'on' : ''} onClick={() => setView('pacu')}>
            PACU Orders
          </button>
          <button className={view === 'billing' ? 'on' : ''} onClick={() => setView('billing')}>
            Billing
          </button>
          <button className={view === 'choices' ? 'on' : ''} onClick={() => setView('choices')}>
            Edit Choices
          </button>
        </div>
        <div className="toolbar-actions">
          <button onClick={() => window.print()}>Print</button>
          <button className={`danger${clearArmed ? ' armed' : ''}`} onClick={handleClear}>
            {clearArmed ? '⚠ Tap again to clear all' : 'Clear form'}
          </button>
        </div>
        <p className="privacy-note">
          No patient name or identifiers are entered here &mdash; apply the patient label sticker after
          printing. All data stays on this device only; clear the form after printing.
          <span className="build-stamp">Version: {__BUILD_DATE__}</span>
        </p>
      </header>

      {view === 'fields' && (
        <FieldByField d={d} set={set} customChoices={choices} onFinish={() => setView('form')} />
      )}
      {view === 'choices' && <EditChoices choices={choices} setChoices={setChoices} />}
      {view === 'anes' && <AnesRecord resetSignal={anesReset} />}
      {view === 'pacu' && <PacuOrders resetSignal={anesReset} />}
      {view === 'billing' && <BillingSheet resetSignal={anesReset} />}

      {view !== 'anes' && view !== 'pacu' && view !== 'billing' && (
      <div className={`page${view === 'form' ? '' : ' print-only-block'}`}>
        <div className="page-top">
          <div className="bc-wrap">
            <Barcode39 value="PRE" />
            <div className="bc-caption">*PRE*</div>
          </div>
        </div>

        <div className="form">
          {/* Title / demographics */}
          <div className="row">
            <div className="cell grow c b caps">Pre Anesthesia Evaluation</div>
            <div className="cell w9"><span className="lbl">Age</span>{txt('age')}</div>
            <div className="cell w11">
              <span className="lbl">Sex</span>
              <span className="opts">{xbx('sex', 'M', 'M')}{xbx('sex', 'F', 'F')}</span>
            </div>
            <div className="cell w15">
              <span className="lbl">Height</span>{txt('height', 'xshort')}
              <span className="opts">{xbx('heightUnit', 'in', 'in')}{xbx('heightUnit', 'cm', 'cm')}</span>
            </div>
            <div className="cell w15">
              <span className="lbl">Weight</span>{txt('weight', 'xshort')}
              <span className="opts">{xbx('weightUnit', 'lb', 'lb')}{xbx('weightUnit', 'kg', 'kg')}</span>
            </div>
          </div>

          <div className="row">
            <div className="cell grow half">
              <span className="lbl">Proposed Procedure</span>
              {txt('proposedProcedure')}
            </div>
            <div className="cell grow half vitals">
              <div className="lbl">Pre-Procedure Vital Signs</div>
              <div className="vitline">
                <span className="b">BP</span>{txt('bp', 'short')}
                <span className="b">P</span>{txt('p', 'short')}
                <span className="b">R</span>{txt('r', 'short')}
                <span className="b">T</span>{txt('t', 'short')}
              </div>
            </div>
          </div>

          <div className="row">
            <div className="cell grow half pair">
              <div className="pair-main">
                <span className="lbl">Previous Anesthesia / Operations</span>
                {d.prevHxList.map((item) => (
                  <div className="detline" key={item.name}>
                    {item.name}
                    {item.detail ? ` — ${item.detail}` : ''}
                  </div>
                ))}
                {ta('previousAnesthesia', d.prevHxList.length ? 1 : 2, d.prevHxList.length && !d.previousAnesthesia ? 'np' : '')}
              </div>
              <div className="none-box">{bx('previousAnesthesiaNone', 'None')}</div>
            </div>
            <div className="cell grow half pair">
              <div className="pair-main">
                <span className="lbl">Current Medications</span>
                {d.meds.map((med) => (
                  <div className="detline" key={med.name}>
                    {med.name}
                    {med.dose ? ` ${med.dose}` : ''}
                    {med.lastDose ? ` — last dose ${med.lastDose}` : ''}
                  </div>
                ))}
                {ta('currentMedications', d.meds.length ? 1 : 2, d.meds.length && !d.currentMedications ? 'np' : '')}
              </div>
              <div className="none-box">{bx('currentMedicationsNone', 'None')}</div>
            </div>
          </div>

          <div className="row">
            <div className="cell grow half pair">
              <div className="pair-main">
                <span className="lbl">Family History of Anesthesia Complications</span>
                {ta('familyHistory', 1)}
              </div>
              <div className="none-box">{bx('familyHistoryNone', 'None')}</div>
            </div>
            <div className="cell grow half pair">
              <div className="pair-main">
                <span className="lbl">Allergies</span>
                {d.allergyList.map((al) => (
                  <div className="detline" key={al.name}>
                    {al.name}
                    {al.reaction ? ` — ${al.reaction}` : ''}
                  </div>
                ))}
                {ta('allergies', 1, d.allergyList.length && !d.allergies ? 'np' : '')}
              </div>
              <div className="none-box">{bx('allergiesNone', 'None')}</div>
            </div>
          </div>

          {/* Airway / history-from */}
          <div className="row">
            <div className="cell grow airway">
              <div>
                <span className="b caps">Airway / Teeth / Head and Neck</span>
                <span className="b gap">Mallampati Class</span>{txt('mallampati', 'u med')}
                <span className="b gap">NPO</span>{txt('npo', 'u med')}
              </div>
              <div>
                <span className="b">TMD</span>{txt('tmd', 'u med')}
                <span className="b gap">ROM</span>{txt('rom', 'u med')}
              </div>
            </div>
            <div className="cell w36 hfrom">
              <div className="b">History From:</div>
              <div className="hf2">
                <div>{bx('hfPatient', 'Patient')}{bx('hfParentGuardian', 'Parent / Guardian')}</div>
                <div>{bx('hfSignificantOther', 'Significant Other')}{bx('hfChart', 'Chart')}</div>
              </div>
              {bx('hfCommLanguage', 'Communication / Language Problems')}
              {bx('hfPoorHistorian', 'Poor Historian')}
            </div>
          </div>

          {/* Systems review + right column */}
          <div className="middle">
            <div className="mleft">
              <div className="row headr">
                <div className="cell sys c b caps">System</div>
                <div className="cell wnlc b">WNL</div>
                <div className="cell com grow c b caps">Comments</div>
              </div>

              {band(
                SYSTEMS[0],
                <>
                  <div className="inlinerow">
                    <span className="b">Tobacco Use:</span> {yn('tobacco')}
                    {txt('tobaccoPacksDay', 'u short')} <span>Packs / Day for</span>
                    {txt('tobaccoYears', 'u short')} <span>Years</span>
                  </div>
                  {d.homeO2 && (
                    <div className="detline">
                      <span className="b">Home O&#8322;:</span>{' '}
                      {d.homeO2 === 'night' ? 'at night' : '24/7'}
                      {d.homeO2Liters ? `, ${d.homeO2Liters} L/min` : ''}
                    </div>
                  )}
                </>,
                2,
              )}
              {band(SYSTEMS[1])}
              {band(
                SYSTEMS[2],
                <>
                  <div className="inlinerow">
                    <span className="b">Ethanol Use:</span> {yn('ethanol')}
                    <span>Frequency</span>{txt('ethanolFreq', 'u med')}
                  </div>
                  <div className="inlinerow">
                    <span className="b">&ldquo;Street Drug&rdquo; Use:</span> {yn('streetDrug')}
                    <span>Frequency</span>{txt('streetDrugFreq', 'u med')}
                  </div>
                </>,
                1,
              )}
              {band(SYSTEMS[3])}
              {band(SYSTEMS[4])}
              {band(SYSTEMS[5])}
            </div>

            <div className="mright">
              <div className="rbox">
                <div className="rhead">{bx('dxNone')} <span className="b caps">Diagnostics Studies</span></div>
                {rslot('EKG', 'dxEkg')}
                {rslot('Chest X-Ray', 'dxCxr')}
                {rslot('Pulmonary Studies', 'dxPulm')}
                {rslot('Other', 'dxOther')}
              </div>
              <div className="rbox">
                <div className="rhead c"><span className="b caps">Laboratory Studies</span></div>
                {rslot('Hgb / Hct / CBC', 'labHgb')}
                {rslot('Electrolytes', 'labElectrolytes')}
                {rslot('Urinalysis', 'labUrinalysis')}
                {rslot('Other', 'labOther')}
              </div>
              <div className="rbox last">
                <div className="rhead c"><span className="b caps">Post-Anesthesia Note</span></div>
                {vitalsPair('pan')}
                <div className="noteslot"><span className="b">NOTES:</span>{ta('panNotes', 2)}</div>
                <div className="sigrow">
                  <div className="sigcell grow"><span className="lbl">Signed</span></div>
                  <div className="sigcell w40"><span className="lbl">Date/Time</span>{txt('panDateTime')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="bottom">
            <div className="bl grow">
              <div className="blrow">
                <div className="blmain grow">
                  <div className="cellrow">
                    <span className="lbl">Problem List / Diagnoses</span>
                    {ta('problemList', 2)}
                  </div>
                  <div className="cellrow last">
                    <span className="lbl">Planned Anesthesia / Special Monitors</span>
                    {ta('plannedAnesthesia', 2)}
                  </div>
                </div>
                <div className="psstrip">
                  <span className="pslabel">Physical Status</span>
                  <div className="psnums">
                    {(['1', '2', '3', '4', '5'] as const).map((n) => (
                      <span key={n} className="psnum">
                        {xbx('physicalStatus', n, n)}
                      </span>
                    ))}
                    <span className="psnum">{bx('physicalStatusE', 'E')}</span>
                  </div>
                </div>
              </div>
              <div className="cellrow topline">
                <span className="lbl">Pre-Anesthesia Medications Ordered</span>
                {ta('preAnesthesiaMeds', 3)}
              </div>
              <div className="sigrow topline">
                <div className="sigcell grow tall"><span className="lbl">Evaluator Signature</span></div>
                <div className="sigcell w40 tall"><span className="lbl">Date/Time</span>{txt('evalDateTime')}</div>
              </div>
            </div>

            <div className="br">
              <div className="rhead c"><span className="b caps">Inpatient Note Post-Anesthesia</span></div>
              {vitalsPair('inp')}
              <div className="noteslot grow"><span className="b">NOTES:</span>{ta('inpNotes', 3)}</div>
              <div className="sigrow topline">
                <div className="sigcell grow tall"><span className="lbl">Signed</span></div>
                <div className="sigcell w40 tall"><span className="lbl">Date/Time</span>{txt('inpDateTime')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="page-foot">
          <div className="foot-id">
            <div className="foot-title">Pre-Anesthesia Evaluation</div>
            <div>170-165-90061 <span className="gap">Page 1 of 1</span></div>
            <div>03/12 (Rev. 06/15, 09/20, 03/21, 03/22)</div>
            <div className="foot-org">Mountain West Medical Center</div>
          </div>
          <div className="plabel">
            <span>Patient Label</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

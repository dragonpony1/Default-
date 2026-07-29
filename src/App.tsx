import { useEffect, useRef, useState } from 'react';
import SigImg from './SigImg';
import { noAuto, numPad, tempPad } from './inputProps';
import { emptyPreopEval, type PreopEval, type YesNo } from './types';
import { SYSTEMS, selectedProblems, type SystemBand } from './formConfig';
import { clearDraft, loadDraft, saveDraft } from './storage';
import Barcode39 from './Barcode39';
import NumPad from './NumPad';
import TempPad from './TempPad';
import StepPad from './StepPad';
import FieldByField from './FieldByField';
import EditChoices from './EditChoices';
import AnesRecord, { clearAnesDraft } from './AnesRecord';
import PacuOrders, { clearPacuDraft } from './PacuOrders';
import PostAnesNote from './PostAnesNote';
import SignaturePad from './SignaturePad';
import BillingSheet, { clearBillingDraft } from './BillingSheet';
import { decodeChoices, loadCustomChoices, saveCustomChoices, type CustomChoices } from './choices';
import { setCaseField, clearCase } from './caseData';
import { clearSigner, useSigner, nowStamp } from './signer';
import ProviderBar from './ProviderBar';
import { applyProviderToDrafts, type ProviderPrefs } from './providers';

type StringKeys = { [K in keyof PreopEval]: PreopEval[K] extends string ? K : never }[keyof PreopEval];
type BoolKeys = { [K in keyof PreopEval]: PreopEval[K] extends boolean ? K : never }[keyof PreopEval];

export default function App() {
  const [d, setD] = useState<PreopEval>(loadDraft);
  const [view, setView] = useState<'fields' | 'form' | 'anes' | 'pacu' | 'billing' | 'choices'>('fields');
  const [anesReset, setAnesReset] = useState(0);
  // Printing the whole chart: every form is mounted at once, printed, then the
  // view goes back to where it was.
  const [printAll, setPrintAll] = useState(false);
  const viewBeforePrint = useRef<typeof view>('fields');
  const [choices, setChoicesState] = useState<CustomChoices>(loadCustomChoices);
  const signer = useSigner();
  const [signTarget, setSignTarget] = useState<{ sig: 'panSig' | 'evalSig' | 'inpSig'; dt: StringKeys } | null>(null);

  const setChoices = (c: CustomChoices) => {
    saveCustomChoices(c);
    setChoicesState(c);
  };

  useEffect(() => {
    saveDraft(d);
  }, [d]);

  // Arriving via a scanned setup QR: the #setup= fragment carries another
  // device's Edit Choices configuration. Confirm, save, and clear the hash so
  // reloads don't re-prompt.
  useEffect(() => {
    const m = window.location.hash.match(/^#setup=(.+)$/);
    if (!m) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const imported = decodeChoices(m[1]);
    if (!imported) return;
    if (window.confirm('Load the scanned Edit Choices setup onto THIS device? It replaces this device’s choice lists. Patient data is not affected.')) {
      saveCustomChoices(imported);
      setChoicesState(imported);
      setView('choices');
    }
  }, []);

  // Share the pre-op allergy assessment into the Case so it pre-populates the
  // record, PACU, and other documents. Only push when there's something to say
  // so an empty pre-op never wipes an allergy typed on another form.
  useEffect(() => {
    const summary = d.allergiesNone
      ? 'None'
      : [
          ...d.allergyList.map((x) => (x.reaction ? `${x.name} (${x.reaction})` : x.name)),
          d.allergies,
        ]
          .filter(Boolean)
          .join(', ');
    if (summary) setCaseField('allergies', summary);
  }, [d.allergiesNone, d.allergyList, d.allergies]);

  // Weight and height flow to the shared case (and onto PACU) just like
  // allergies. Fill both lb and kg from whichever unit was entered.
  useEffect(() => {
    const w = d.weight.trim();
    if (!w) return;
    const n = Number(w);
    if (d.weightUnit === 'kg') {
      setCaseField('weightKg', w);
      if (!Number.isNaN(n)) setCaseField('weight', String(Math.round(n * 2.2046)));
    } else {
      setCaseField('weight', w);
      if (!Number.isNaN(n)) setCaseField('weightKg', String(Math.round(n / 2.2046)));
    }
  }, [d.weight, d.weightUnit]);

  useEffect(() => {
    const h = d.height.trim();
    if (h) setCaseField('height', d.heightUnit ? `${h} ${d.heightUnit}` : h);
  }, [d.height, d.heightUnit]);

  // The record's Procedure and Diagnosis lines are the same facts the pre-op
  // already captured, so they flow across rather than being typed twice.
  useEffect(() => {
    const p = d.proposedProcedure.trim();
    if (p) setCaseField('procedure', p);
  }, [d.proposedProcedure]);

  // The record's and billing sheet's Diagnosis is the surgical indication, not
  // the patient's medical problem list — those are different fields on paper
  // and must not be conflated.
  useEffect(() => {
    const dx = d.surgicalDx.trim();
    if (dx) setCaseField('diagnosis', dx);
  }, [d.surgicalDx]);


  const set = <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const doPrintAll = () => {
    viewBeforePrint.current = view;
    setView('form'); // the pre-op sheet leads; the rest mount alongside it
    setPrintAll(true);
  };

  const endPrintAll = () => {
    setPrintAll(false);
    setView(viewBeforePrint.current);
  };

  // The print dialog does not hold the page still everywhere. On the tablet,
  // window.print() hands off to the system print preview and returns straight
  // away, so putting the view back on the next line tore the extra sheets down
  // before the preview had taken its snapshot — and the packet came out as
  // whichever single sheet happened to be on screen. So: print once the sheets
  // have laid out, then leave them mounted until the print actually finishes,
  // or until the packet banner is dismissed by hand.
  useEffect(() => {
    if (!printAll) return;
    let sent = false;
    const t = setTimeout(() => {
      sent = true;
      window.print();
    }, 400);
    const done = () => {
      if (sent) endPrintAll();
    };
    window.addEventListener('afterprint', done);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printAll]);

  // A cached build can otherwise persist across launches, making it look like
  // a fix never shipped. This drops the service worker and every cache, then
  // reloads. Entered data lives in localStorage and is untouched.
  const forceUpdate = async () => {
    if (!window.confirm('Reload the app and fetch the newest version? Needs internet. Your entered data is kept.')) return;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // fall through to the reload regardless
    }
    window.location.reload();
  };

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
      clearCase();
      clearSigner();
      setD({ ...emptyPreopEval });
      setAnesReset((n) => n + 1);
    }
  };

  // A provider "clicks in": merge their saved standing choices into the drafts,
  // apply the pre-op patch, and bump the reset signal so the mounted forms
  // reload with the applied preferences.
  const applyProvider = (prefs: ProviderPrefs) => {
    const patch = applyProviderToDrafts(prefs);
    if (patch.plannedAnesthesia != null && patch.plannedAnesthesia !== '') {
      setD((prev) => ({ ...prev, plannedAnesthesia: patch.plannedAnesthesia as string }));
    }
    setAnesReset((n) => n + 1);
  };

  // Borderless inline text input
  const txt = (k: StringKeys, cls = '') => (
    <input {...noAuto} className={`t ${cls}`} value={d[k]} onChange={(e) => set(k, e.target.value)} />
  );

  // Date/time blank with a one-tap "Now" stamp beside it.
  const dtCell = (label: string, k: StringKeys, cls = 'w40') => (
    <div className={`sigcell ${cls}`}>
      <span className="lbl">{label}</span>
      {txt(k)}
      <button
        type="button"
        className="chip sig-btn screen-only"
        onClick={() => {
          const { date, time } = nowStamp();
          set(k, `${date} ${time}`);
        }}
      >
        🕐
      </button>
    </div>
  );

  // Signature cell: shows the stamped signature image; the clicked-in
  // provider's saved signature stamps with one tap and fills the date/time.
  const sigCell = (label: string, sigKey: 'panSig' | 'evalSig' | 'inpSig', dtKey: StringKeys) => (
    <div className="sigcell grow tall">
      <span className="lbl">{label}</span>
      {d[sigKey] && <SigImg src={d[sigKey]} />}
      <span className="sig-actions screen-only">
        <button
          type="button"
          className="chip sig-btn"
          onClick={() => {
            if (signer.signature) {
              const { date, time } = nowStamp();
              setD((prev) => ({ ...prev, [sigKey]: signer.signature, [dtKey]: `${date} ${time}` }));
            } else {
              setSignTarget({ sig: sigKey, dt: dtKey });
            }
          }}
        >
          {d[sigKey] ? '↻' : signer.signature ? `✍ ${signer.initials}` : '✍ Sign'}
        </button>
        {d[sigKey] && (
          <button type="button" className="chip sig-btn" onClick={() => setD((prev) => ({ ...prev, [sigKey]: '' }))}>✕</button>
        )}
      </span>
    </div>
  );

  // Numeric variant: floating 10-key instead of the OS keyboard
  const txn = (k: StringKeys, cls = '') => (
    <input {...numPad} className={`t ${cls}`} value={d[k]} onChange={(e) => set(k, e.target.value)} />
  );

  // Temperature variant: floating slider
  const txT = (k: StringKeys, cls = '') => (
    <input {...tempPad} className={`t ${cls}`} value={d[k]} onChange={(e) => set(k, e.target.value)} />
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
        <div className="vrow"><span>BP</span>{txn(`${pre}Bp` as StringKeys)}</div>
        <div className="vrow"><span>P</span>{txn(`${pre}P` as StringKeys)}</div>
        <div className="vrow"><span>R</span>{txn(`${pre}R` as StringKeys)}</div>
        <div className="vrow"><span>T</span>{txT(`${pre}T` as StringKeys)}</div>
        <div className="vrow"><span>O&#8322; Sat.</span>{txn(`${pre}O2` as StringKeys)}</div>
        <div className="vrow"><span>Pain (0&ndash;10)</span>{txn(`${pre}Pain` as StringKeys)}</div>
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
      <NumPad />
      <TempPad />
      <StepPad />
      {signTarget && (
        <SignaturePad
          onSave={(sig) => {
            const { date, time } = nowStamp();
            setD((prev) => ({ ...prev, [signTarget.sig]: sig, [signTarget.dt]: `${date} ${time}` }));
            setSignTarget(null);
          }}
          onCancel={() => setSignTarget(null)}
        />
      )}
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
          <button onClick={doPrintAll} title="Pre-op, record, PACU orders and billing">🖨 Print all</button>
          <button className="ghost" onClick={forceUpdate} title="Fetch the newest version">↻ Update</button>
          <button className={`danger${clearArmed ? ' armed' : ''}`} onClick={handleClear}>
            {clearArmed ? '⚠ Tap again to clear all' : 'Clear form'}
          </button>
        </div>
        <ProviderBar onApply={applyProvider} />
        <p className="privacy-note">
          No patient name or identifiers are entered here &mdash; apply the patient label sticker after
          printing. All data stays on this device only; clear the form after printing.
          <span className="build-stamp">Version: {__BUILD_DATE__}</span>
        </p>
      </header>

      {printAll && (
        <div className="pa-banner screen-only">
          <span className="pa-bannertext">
            <b>Printing the packet</b> &mdash; pre-op, record, PACU orders, billing (4 pages).
            Leave this up until the printout finishes.
          </span>
          <button type="button" className="chip" onClick={() => window.print()}>🖨 Print again</button>
          <button type="button" className="chip on" onClick={endPrintAll}>✓ Done</button>
        </div>
      )}

      {view === 'fields' && (
        <FieldByField d={d} set={set} customChoices={choices} onFinish={() => setView('form')} />
      )}
      {view === 'choices' && <EditChoices choices={choices} setChoices={setChoices} />}
      {view === 'anes' && <AnesRecord resetSignal={anesReset} />}
      {view === 'pacu' && <PostAnesNote d={d} set={set} />}
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
            <div className="cell w9"><span className="lbl">Age</span>{txn('age')}</div>
            <div className="cell w11">
              <span className="lbl">Sex</span>
              <span className="opts">{xbx('sex', 'M', 'M')}{xbx('sex', 'F', 'F')}</span>
            </div>
            <div className="cell w15">
              <span className="lbl">Height</span>{txn('height', 'xshort')}
              <span className="opts">{xbx('heightUnit', 'in', 'in')}{xbx('heightUnit', 'cm', 'cm')}</span>
            </div>
            <div className="cell w15">
              <span className="lbl">Weight</span>{txn('weight', 'xshort')}
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
                <span className="b">BP</span>{txn('bp', 'short')}
                <span className="b">P</span>{txn('p', 'short')}
                <span className="b">R</span>{txn('r', 'short')}
                <span className="b">T</span>{txT('t', 'short')}
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
                    {txn('tobaccoPacksDay', 'u short')} <span>Packs / Day for</span>
                    {txn('tobaccoYears', 'u short')} <span>Years</span>
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
                  {sigCell('Signed', 'panSig', 'panDateTime')}
                  {dtCell('Date/Time', 'panDateTime', 'w40')}
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
                    {(() => {
                      const probs = selectedProblems(d.checks, d.customConditions);
                      return probs.length ? <div className="detline">{probs.join(', ')}</div> : null;
                    })()}
                    {ta('problemList', selectedProblems(d.checks, d.customConditions).length && !d.problemList ? 1 : 2, selectedProblems(d.checks, d.customConditions).length && !d.problemList ? 'np' : '')}
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
                {sigCell('Evaluator Signature', 'evalSig', 'evalDateTime')}
                {dtCell('Date/Time', 'evalDateTime', 'w40 tall')}
              </div>
            </div>

            <div className="br">
              <div className="rhead c"><span className="b caps">Inpatient Note Post-Anesthesia</span></div>
              {vitalsPair('inp')}
              <div className="noteslot grow"><span className="b">NOTES:</span>{ta('inpNotes', 3)}</div>
              <div className="sigrow topline">
                {sigCell('Signed', 'inpSig', 'inpDateTime')}
                {dtCell('Date/Time', 'inpDateTime', 'w40 tall')}
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

      {printAll && (
        <>
          <div className="pa-sheet"><AnesRecord resetSignal={anesReset} /></div>
          <div className="pa-sheet"><PacuOrders resetSignal={anesReset} /></div>
          <div className="pa-sheet"><BillingSheet resetSignal={anesReset} /></div>
        </>
      )}
    </div>
  );
}

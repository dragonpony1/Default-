import { useEffect, useRef, useState } from 'react';
import SigImg from './SigImg';
import { noAuto, npoPad, numPad, tempPad } from './inputProps';
import { emptyPreopEval, type PreopEval, type YesNo } from './types';
import { SYSTEMS, selectedProblems, effectiveWnl, type SystemBand } from './formConfig';
import { clearDraft, loadDraft, saveDraft } from './storage';
import Barcode39 from './Barcode39';
import NumPad from './NumPad';
import TempPad from './TempPad';
import StepPad from './StepPad';
import DatePad from './DatePad';
import PacketReview from './PacketReview';
import FieldByField from './FieldByField';
import EditChoices from './EditChoices';
import AnesRecord, { clearAnesDraft } from './AnesRecord';
import PacuOrders, { clearPacuForNextCase } from './PacuOrders';
import PostAnesNote from './PostAnesNote';
import SignaturePad from './SignaturePad';
import BillingSheet, { clearBillingDraft } from './BillingSheet';
import ShareApp from './ShareApp';
import BlockDoc, { clearBlockDraft } from './BlockDoc';
import ProcNote, { clearProcDraft } from './ProcNote';
import { ANES_KEY, writeSheetTx } from './drafts';
import { decodeChoices, loadCustomChoices, saveCustomChoices, type CustomChoices } from './choices';
import { setCaseField, clearCase, getCase, useCaseData } from './caseData';
import { useSigner, nowStamp } from './signer';
import ProviderBar from './ProviderBar';
import { applyProviderToDrafts, nameForSignature, type ProviderPrefs } from './providers';

// The packet, in the order it prints.
const PACKET_SHEETS = ['Pre-Op', 'Record', 'Block', 'PACU Orders', 'Billing'];

type StringKeys = { [K in keyof PreopEval]: PreopEval[K] extends string ? K : never }[keyof PreopEval];
type BoolKeys = { [K in keyof PreopEval]: PreopEval[K] extends boolean ? K : never }[keyof PreopEval];

export default function App() {
  const [d, setD] = useState<PreopEval>(loadDraft);
  const [view, setView] = useState<'fields' | 'form' | 'anes' | 'block' | 'proc' | 'pacu' | 'billing' | 'choices' | 'packet'>('fields');
  const [anesReset, setAnesReset] = useState(0);
  // The Print Packet tab holds all four sheets at once, mounted and laid out
  // like any other tab, so printing it is an ordinary print of what is on the
  // screen. `solo` restricts the print to one of them, for a printer or
  // browser that will not carry a four-page job.
  const [solo, setSolo] = useState<number | null>(null);
  const [review, setReview] = useState(false);
  // Left the review to answer something on its own tab: the way back stays put.
  const [fromReview, setFromReview] = useState(false);
  // Where Edit Choices was opened from, so tapping it again comes back here.
  const beforeChoices = useRef<typeof view>('fields');
  const [choices, setChoicesState] = useState<CustomChoices>(loadCustomChoices);
  const signer = useSigner();
  const caseData = useCaseData();
  const [signTarget, setSignTarget] = useState<{ sig: 'panSig' | 'evalSig' | 'inpSig'; dt: StringKeys; nm: StringKeys } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Where the packet tab was entered from, so its Back button returns there.
  const beforePacket = useRef<typeof view>('fields');
  useEffect(() => {
    if (view !== 'packet' && view !== 'choices') beforePacket.current = view;
  }, [view]);

  // An endoscopy assignment: the endo nurse charts the vitals on her own
  // record, so the packet prints without the anesthesia record — pre-op,
  // PACU orders and billing only. The mode is the day's assignment, not
  // patient data: it survives Clear form and stays until toggled off.
  const [endoDay, setEndoDay] = useState(() => localStorage.getItem('endo-day-v1') === '1');
  useEffect(() => {
    localStorage.setItem('endo-day-v1', endoDay ? '1' : '0');
    if (endoDay) {
      // The record's OR box says Endo, so even an unprinted record agrees.
      writeSheetTx(ANES_KEY, 'orNum', 'Endo');
      setAnesReset((n) => n + 1);
    }
  }, [endoDay]);

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


  // The ASA graded on the pre-op is the case's ASA; the record reads it.
  useEffect(() => {
    if (d.physicalStatus) setCaseField('asa', d.physicalStatus);
    setCaseField('asaE', d.physicalStatusE);
  }, [d.physicalStatus, d.physicalStatusE]);

  // The date on the signed pre-op evaluation is the case date. When the
  // pre-op is the first document of the day, this is what carries the date
  // onto the record, the PACU orders and the billing sheet. A date already on
  // the case (typed on the record) is never overwritten.
  useEffect(() => {
    const date = (d.evalDateTime || '').trim().split(/\s+/)[0];
    if (date && date.includes('/') && !getCase().caseDate) setCaseField('caseDate', date);
  }, [d.evalDateTime]);

  const set = <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const packet = view === 'packet';
  // A sheet left out of the print when one page has been picked on its own.
  const soloCls = (i: number) => (solo !== null && solo !== i ? ' pk-hide' : '');


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
    if (window.confirm(
      'Clear the forms for the next patient? Everything entered about this one is wiped and cannot be recovered.\n\n'
      + 'Your PACU orders are kept — they are standing orders, not patient data — minus the signature.',
    )) {
      clearDraft();
      clearAnesDraft();
      clearPacuForNextCase();
      clearBillingDraft();
      clearBlockDraft();
      clearProcDraft();
      clearCase();
      // The endo assignment outlives the case: re-stamp the fresh record.
      if (endoDay) writeSheetTx(ANES_KEY, 'orNum', 'Endo');
      // Whoever is clicked in stays clicked in — the provider is not the
      // patient's data. Their signatures on the cleared forms are gone with
      // the forms.
      setD({ ...emptyPreopEval });
      setAnesReset((n) => n + 1);
    }
  };

  // Clear one form without touching the rest of the packet. The shared case
  // facts (date, times, procedure, surgeon) belong to the case, not to any one
  // sheet, so they stay — boxes that fill from them will fill again.
  const [clearPageArmed, setClearPageArmed] = useState(false);
  const clearPageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarmClearPage = () => {
    if (clearPageTimer.current) clearTimeout(clearPageTimer.current);
    clearPageTimer.current = null;
    setClearPageArmed(false);
  };

  // Changing tabs stands both armed clears down: an armed button must always
  // be aiming at the page it was armed on.
  useEffect(() => {
    disarmClear();
    disarmClearPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const pageClear = (() => {
    switch (view) {
      case 'fields':
      case 'form':
        return {
          name: 'Pre-Op',
          note: '',
          run: () => {
            clearDraft();
            setD({ ...emptyPreopEval });
          },
        };
      case 'anes':
        return {
          name: 'Anesthesia Record',
          note: '',
          run: () => {
            clearAnesDraft();
            // The endo assignment outlives the sheet: re-stamp the OR box.
            if (endoDay) writeSheetTx(ANES_KEY, 'orNum', 'Endo');
          },
        };
      case 'block':
        return {
          name: 'Block sheet',
          note: 'The block page comes out of the packet too — filling it again puts it back.',
          run: () => {
            clearBlockDraft();
            setCaseField('blockCase', false);
          },
        };
      case 'proc':
        // The proc tab shows the note with the billing sheet under it — on a
        // stand-alone procedure those two print together, so they clear
        // together too.
        return {
          name: 'Proc Note + Billing',
          note: 'This tab shows both, so both are cleared together.',
          run: () => {
            clearProcDraft();
            clearBillingDraft();
          },
        };
      case 'pacu':
        return {
          name: 'PACU Orders',
          note: 'Your standing orders are kept — the signature, times and vitals go.',
          run: clearPacuForNextCase,
        };
      case 'billing':
        return {
          name: 'Billing sheet',
          note: '',
          run: clearBillingDraft,
        };
      default:
        return null;
    }
  })();

  const handleClearPage = () => {
    if (!pageClear) return;
    if (!clearPageArmed) {
      setClearPageArmed(true);
      clearPageTimer.current = setTimeout(() => setClearPageArmed(false), 5000);
      return;
    }
    disarmClearPage();
    if (window.confirm(
      `Clear the ${pageClear.name} only? The other forms are kept, and shared case facts `
      + '(date, times, procedure) stay — boxes that come from them will refill.'
      + (pageClear.note ? `\n\n${pageClear.note}` : ''),
    )) {
      pageClear.run();
      setAnesReset((n) => n + 1);
    }
  };

  // A provider "clicks in": merge their saved standing choices into the drafts,
  // apply the pre-op patch, and bump the reset signal so the mounted forms
  // reload with the applied preferences.
  const applyProvider = (prefs: ProviderPrefs) => {
    const patch = applyProviderToDrafts(prefs);
    // The saved pre-op answers land on the wizard — only the fields that were
    // saved, merged over the case in progress.
    if (Object.keys(patch.preop).length) {
      setD((prev) => ({ ...prev, ...patch.preop }));
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
  const sigCell = (label: string, sigKey: 'panSig' | 'evalSig' | 'inpSig', dtKey: StringKeys) => {
    const nameKey = `${sigKey}Name` as StringKeys;
    return (
    <div className="sigcell grow tall">
      <span className="lbl">{label}</span>
      {d[sigKey] && <SigImg src={d[sigKey]} />}
      {d[sigKey] && nameForSignature(d[sigKey], d[nameKey]) && (
        <span className="signame">{nameForSignature(d[sigKey], d[nameKey])}</span>
      )}
      <span className="sig-actions screen-only">
        <button
          type="button"
          className="chip sig-btn"
          onClick={() => {
            if (signer.signature) {
              const { date, time } = nowStamp();
              setD((prev) => ({
                ...prev,
                [sigKey]: signer.signature,
                [dtKey]: `${date} ${time}`,
                [nameKey]: signer.name || signer.initials,
              }));
            } else {
              setSignTarget({ sig: sigKey, dt: dtKey, nm: nameKey });
            }
          }}
        >
          {d[sigKey] ? '↻' : signer.signature ? `✍ ${signer.initials}` : '✍ Sign'}
        </button>
        {d[sigKey] && (
          <button type="button" className="chip sig-btn" onClick={() => setD((prev) => ({ ...prev, [sigKey]: '', [nameKey]: '' }))}>✕</button>
        )}
      </span>
    </div>
    );
  };

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
  const xbx = <K extends 'sex' | 'heightUnit' | 'weightUnit' | 'physicalStatus' | 'hcg'>(
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
          checked={effectiveWnl(d, s.key)}
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

  // Mutually-exclusive tappable options that write a string field (re-tap to
  // clear). Used for the Post-Anesthesia Note assessments.
  const optPick = (k: StringKeys, opts: string[]) => (
    <span className="panopts">
      {opts.map((o) => (
        <label className="ck" key={o}>
          <input type="checkbox" checked={d[k] === o} onChange={(e) => set(k, (e.target.checked ? o : '') as PreopEval[StringKeys])} />
          <span>{o}</span>
        </label>
      ))}
    </span>
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
        <div className="vrow"><span>N/V</span>{optPick(`${pre}NV` as StringKeys, ['Yes', 'No'])}</div>
        <div className="vrow"><span>Airway Patency</span>{optPick(`${pre}Airway` as StringKeys, ['WNL'])}</div>
        <div className="vrow"><span>Mental Status</span>{optPick(`${pre}Mental` as StringKeys, ['A&O', 'Asleep', 'Arousable'])}</div>
        {pre === 'pan' && (
          <div className="vrow">
            <span>Hydration</span>
            {optPick('panHydration', ['LR', 'NS'])}
            {txt('panHydrationVol', 'xshort')}
            <span>mL</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app">
      <NumPad />
      <TempPad />
      <StepPad />
      <DatePad />
      {signTarget && (
        <SignaturePad
          onSave={(sig) => {
            const { date, time } = nowStamp();
            setD((prev) => ({
              ...prev,
              [signTarget.sig]: sig,
              [signTarget.dt]: `${date} ${time}`,
              [signTarget.nm]: signer.name || signer.initials,
            }));
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
          <button className={view === 'block' ? 'on' : ''} onClick={() => setView('block')}>
            Block
          </button>
          <button className={view === 'proc' ? 'on' : ''} onClick={() => setView('proc')}>
            Proc Note
          </button>
          <button className={view === 'pacu' ? 'on' : ''} onClick={() => setView('pacu')}>
            PACU Orders
          </button>
          <button className={view === 'billing' ? 'on' : ''} onClick={() => setView('billing')}>
            Billing
          </button>
          <button className={view === 'packet' ? 'on' : ''} onClick={() => setView('packet')}>
            🖨 Print Packet
          </button>
          {/* A toggle: duck in to add or drop a choice, tap again and you are
              back on the form you were working on. */}
          <button
            className={view === 'choices' ? 'on' : ''}
            onClick={() => {
              if (view === 'choices') {
                setView(beforeChoices.current);
                return;
              }
              beforeChoices.current = view;
              setView('choices');
            }}
          >
            {view === 'choices' ? '✓ Done editing' : 'Edit Choices'}
          </button>
        </div>
        <div className="toolbar-actions">
          <button onClick={() => window.print()}>Print</button>
          <button className="ghost" onClick={forceUpdate} title="Fetch the newest version">↻ Update</button>
          <button className="ghost" onClick={() => setShareOpen(true)} title="QR and link for another provider's phone or tablet">📤 Share app</button>
          {pageClear && (
            <button
              className={`danger page-clear${clearPageArmed ? ' armed' : ''}`}
              title={`Wipes the ${pageClear.name} only — every other form keeps what it has.`}
              onClick={handleClearPage}
            >
              {clearPageArmed ? `⚠ Tap again — ${pageClear.name} only` : 'Clear this page'}
            </button>
          )}
          <button className={`danger${clearArmed ? ' armed' : ''}`} onClick={handleClear}>
            {clearArmed ? '⚠ Tap again to clear all' : 'Clear all forms'}
          </button>
        </div>
        <ProviderBar onApply={applyProvider} />
        <p className="privacy-note">
          No patient name or identifiers are entered here &mdash; apply the patient label sticker after
          printing. All data stays on this device only; clear the form after printing.
          <span className="build-stamp">Version: {__BUILD_DATE__}</span>
        </p>
      </header>

      {fromReview && !packet && (
        <div className="pk-back screen-only">
          <span>Answering a blank the pre-print check found.</span>
          <button
            type="button"
            className="chip on"
            onClick={() => {
              setFromReview(false);
              setView('packet');
              setReview(true);
            }}
          >
            ← Back to the check
          </button>
        </div>
      )}

      {packet && (
        <section className="pk-head screen-only">
          <div className="pk-row">
            <button
              type="button"
              className="chip pk-exit"
              onClick={() => {
                setReview(false);
                setSolo(null);
                setView(beforePacket.current);
              }}
            >
              ← Back to the forms
            </button>
            <button
              type="button"
              className="pk-big"
              onClick={() => {
                setSolo(null);
                // Nothing prints with a blank on it unnoticed: the review opens
                // first and only stands down when there is nothing left to ask.
                setReview(true);
              }}
            >
              🖨 Print all {(endoDay ? 3 : 4) + (caseData.blockCase ? 1 : 0)} pages
            </button>
            <button
              type="button"
              className={`chip pk-endo${endoDay ? ' on' : ''}`}
              title="Endoscopy assignment: the endo nurse charts vitals on her own record, so the packet prints without the anesthesia record. Stays on through Clear form until tapped off."
              onClick={() => {
                setEndoDay(!endoDay);
                if (solo === 1) setSolo(null);
              }}
            >
              🔬 Endo day{endoDay ? ' — no record sheet' : ''}
            </button>
            <button
              type="button"
              className={`chip pk-endo${caseData.blockCase ? ' on' : ''}`}
              title="A peripheral nerve block was done: the Block Documentation sheet joins the packet. Filling anything on the Block tab turns this on by itself."
              onClick={() => {
                setCaseField('blockCase', !caseData.blockCase);
                if (solo === 2) setSolo(null);
              }}
            >
              🦵 Block sheet{caseData.blockCase ? ' — in the packet' : ''}
            </button>
            <span className="pk-hint">
              {endoDay
                ? 'Endo: pre-op, PACU orders and billing print — the anesthesia record stays out (the endo nurse charts the vitals on her own record).'
                : 'Pre-op, anesthesia record, PACU orders and billing all live on this tab, laid out below in printing order — what you scroll through here is what comes out. Printing runs a last check for blanks first.'}
            </span>
          </div>
          {review && (
            <PacketReview
              d={d}
              set={set}
              endo={endoDay}
              block={caseData.blockCase}
              onGo={(tab) => {
                setReview(false);
                setFromReview(true);
                setView(tab);
              }}
              onPrint={() => {
                setReview(false);
                setTimeout(() => window.print(), 100);
              }}
              onClose={() => setReview(false)}
              onDraftsChanged={() => setAnesReset((n) => n + 1)}
            />
          )}
          <div className="pk-row pk-solorow">
            <span className="pk-sololbl">Or one page at a time:</span>
            {PACKET_SHEETS.map((name, i) =>
              (endoDay && i === 1) || (!caseData.blockCase && i === 2) ? null : (
                <button
                  key={name}
                  type="button"
                  className={`chip${solo === i ? ' on' : ''}`}
                  onClick={() => setSolo(solo === i ? null : i)}
                >
                  {endoDay ? name : `${i + 1}. ${name}`}
                </button>
              ),
            )}
            {solo !== null && (
              <button type="button" className="chip on" onClick={() => window.print()}>
                🖨 Print page {solo + 1} only
              </button>
            )}
          </div>
          {solo !== null && (
            <p className="pk-note">
              Only page {solo + 1} ({PACKET_SHEETS[solo]}) will print. The greyed-out sheets below are
              being left out &mdash; tap <b>{solo + 1}. {PACKET_SHEETS[solo]}</b> again for all four.
            </p>
          )}
        </section>
      )}

      {view === 'fields' && (
        <FieldByField d={d} set={set} customChoices={choices} onFinish={() => setView('form')} />
      )}
      {shareOpen && <ShareApp onClose={() => setShareOpen(false)} />}
      {view === 'choices' && <EditChoices choices={choices} setChoices={setChoices} />}
      {view === 'anes' && (
        <AnesRecord
          resetSignal={anesReset}
          // Landing the case ends at the pre-print check: everything still
          // blank across the packet gets asked in one sweep, then print.
          onLand={() => {
            setSolo(null);
            setView('packet');
            setReview(true);
          }}
        />
      )}
      {view === 'block' && <BlockDoc resetSignal={anesReset} />}
      {view === 'proc' && <ProcNote resetSignal={anesReset} onDraftsChanged={() => setAnesReset((n) => n + 1)} />}
      {/* A standalone procedure prints exactly two pages: the note and the
          billing sheet — so billing rides along as the second printed page. */}
      {view === 'proc' && <div className="pa-sheet"><BillingSheet resetSignal={anesReset} /></div>}
      {view === 'pacu' && <PostAnesNote d={d} set={set} />}
      {view === 'pacu' && <PacuOrders resetSignal={anesReset} />}
      {view === 'billing' && <BillingSheet resetSignal={anesReset} />}


      {view !== 'anes' && view !== 'pacu' && view !== 'billing' && view !== 'block' && view !== 'proc' && (
      <div className={`page preop-page${view === 'form' || packet ? '' : ' print-only-block'}${packet ? soloCls(0) : ''}`}>
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
                <span className="b gap">NPO</span>
                <input {...npoPad} className="t u med" value={d.npo} onChange={(e) => set('npo', e.target.value)} />
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
                <div className="rslot hcgslot">
                  <span className="rlabel">hCG</span>
                  <span className="opts">
                    {xbx('hcg', 'pos', 'Pos')}
                    {xbx('hcg', 'neg', 'Neg')}
                    {xbx('hcg', 'na', 'Not needed')}
                  </span>
                </div>
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
                    {/* The surgical diagnosis leads the box — the indication
                        for the operation, read off the shared case so it shows
                        here no matter which form it was typed on. */}
                    {caseData.diagnosis.trim() && (
                      <div className="detline"><span className="b">Surgical Dx:</span> {caseData.diagnosis.trim()}</div>
                    )}
                    {(() => {
                      const probs = selectedProblems(d.checks, d.customConditions, d.checkDetails);
                      return probs.length ? <div className="detline">{probs.join(', ')}</div> : null;
                    })()}
                    {ta('problemList', selectedProblems(d.checks, d.customConditions, d.checkDetails).length && !d.problemList ? 1 : 2, selectedProblems(d.checks, d.customConditions, d.checkDetails).length && !d.problemList ? 'np' : '')}
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

      {packet && (
        <>
          <div className={`pa-sheet${soloCls(1)}${endoDay ? ' pk-hide' : ''}`}><AnesRecord resetSignal={anesReset} /></div>
          <div className={`pa-sheet${soloCls(2)}${caseData.blockCase ? '' : ' pk-hide'}`}><BlockDoc resetSignal={anesReset} /></div>
          <div className={`pa-sheet${soloCls(3)}`}><PacuOrders resetSignal={anesReset} /></div>
          <div className={`pa-sheet${soloCls(4)}`}><BillingSheet resetSignal={anesReset} /></div>
        </>
      )}
    </div>
  );
}

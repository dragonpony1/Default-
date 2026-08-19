import { useEffect, useRef, useState } from 'react';
import { datePad, noAuto, timePad } from './inputProps';
import { useCaseData, setCaseField } from './caseData';
import { BILLING_KEY, readSheet, writeSheetTx } from './drafts';
import Barcode39 from './Barcode39';
import SigImg from './SigImg';
import SignaturePad from './SignaturePad';
import { nameForSignature } from './providers';
import { nowStamp, useSigner } from './signer';

// Procedural note on the hospital's Progress Notes sheet (QHC-NS-2505HMS):
// called in for a lumbar puncture, a blood patch, an intubation — pick the
// procedure, tap its particulars, and the note writes itself onto the ruled
// page, editable like any text, signed, dated and timed. Print one for the
// chart and one for billing.

const KEY = 'proc-note-draft-v1';

interface ProcDraft {
  tx: Record<string, string>;
}

function loadProc(): ProcDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { tx: {} };
    const parsed = JSON.parse(raw) as Partial<ProcDraft>;
    return { tx: parsed.tx ?? {} };
  } catch {
    return { tx: {} };
  }
}

export function clearProcDraft(): void {
  localStorage.removeItem(KEY);
}

type Params = Record<string, string>;

interface Template {
  key: string;
  label: string;
  procName: string; // onto the case, and from there the billing sheet
  cpt: string; // into billing's add-a-code box, while that box is blank
  params: Array<{ k: string; label: string; opts: string[] }>;
  compose: (p: Params) => string;
}

const TEMPLATES: Template[] = [
  {
    key: 'lp',
    label: '💉 Lumbar puncture',
    procName: 'Lumbar puncture',
    cpt: '62270',
    params: [
      { k: 'site', label: 'Interspace', opts: ['L2-3', 'L3-4', 'L4-5'] },
      { k: 'needle', label: 'Needle', opts: ['22-gauge', '25-gauge'] },
      { k: 'position', label: 'Position', opts: ['lateral decubitus', 'sitting'] },
    ],
    compose: (p) =>
      `Called to perform lumbar puncture. Consent obtained; risks and benefits discussed with the patient. ` +
      `Patient placed in the ${p.position || 'lateral decubitus'} position. The ${p.site || 'L3-4'} interspace was identified. ` +
      `The area was prepped and draped in sterile fashion and the skin infiltrated with 1% lidocaine. ` +
      `A ${p.needle || '22-gauge'} spinal needle was advanced and clear CSF returned. ` +
      `Samples were collected and sent to the laboratory. The needle was removed and a sterile dressing applied. ` +
      `The patient tolerated the procedure well with no complications. Post-procedure instructions given.`,
  },
  {
    key: 'ebp',
    label: '🩸 Epidural blood patch',
    procName: 'Epidural blood patch',
    cpt: '62273',
    params: [
      { k: 'level', label: 'Level', opts: ['L2-3', 'L3-4', 'L4-5'] },
      { k: 'volume', label: 'Blood volume', opts: ['10 mL', '15 mL', '20 mL'] },
    ],
    compose: (p) =>
      `Called to perform an epidural blood patch for post-dural puncture headache. Consent obtained; risks and benefits discussed with the patient. ` +
      `Patient positioned and the area prepped and draped in sterile fashion; skin infiltrated with 1% lidocaine. ` +
      `The epidural space was identified at ${p.level || 'L3-4'} using loss-of-resistance technique. ` +
      `${p.volume || '15 mL'} of autologous blood was drawn under sterile technique and injected slowly into the epidural space without difficulty. ` +
      `The needle was removed and a sterile dressing applied. The patient reported improvement of symptoms and tolerated the procedure well with no complications. ` +
      `Post-procedure instructions given, including to remain supine for one hour.`,
  },
  {
    key: 'ett',
    label: '🫁 Intubation',
    procName: 'Emergency endotracheal intubation',
    cpt: '31500',
    params: [
      { k: 'indication', label: 'Indication', opts: ['respiratory failure', 'airway protection', 'cardiac arrest'] },
      { k: 'blade', label: 'Laryngoscope', opts: ['Mac 3', 'Mac 4', 'Miller 2', 'video laryngoscope'] },
      { k: 'ett', label: 'ETT', opts: ['6.5', '7.0', '7.5', '8.0'] },
      { k: 'depth', label: 'Depth at lip', opts: ['21 cm', '22 cm', '23 cm'] },
    ],
    compose: (p) =>
      `Called emergently for endotracheal intubation for ${p.indication || 'airway protection'}. ` +
      `The patient was preoxygenated. Laryngoscopy performed with ${p.blade || 'Mac 3'}. ` +
      `A ${p.ett || '7.0'} endotracheal tube was passed through the vocal cords under direct visualization to ${p.depth || '22 cm'} at the lip and the cuff inflated. ` +
      `Placement was confirmed with end-tidal CO2 and bilateral breath sounds. The tube was secured. ` +
      `The patient was placed on the ventilator and report was given to the primary team. ` +
      `The patient tolerated the procedure without complication.`,
  },
];

export default function ProcNote({ resetSignal = 0, onDraftsChanged }: { resetSignal?: number; onDraftsChanged?: () => void }) {
  const [d, setD] = useState<ProcDraft>(loadProc);
  const [padOpen, setPadOpen] = useState(false);
  const caseData = useCaseData();
  const signer = useSigner();

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(d));
  }, [d]);

  const seenReset = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== seenReset.current) {
      seenReset.current = resetSignal;
      setD(loadProc());
    }
  }, [resetSignal]);

  const setTx = (k: string, v: string) => setD((p) => ({ ...p, tx: { ...p.tx, [k]: v } }));

  // The note's date rides the case date while blank, like every other sheet.
  useEffect(() => {
    if (!caseData.caseDate) return;
    setD((p) => ((p.tx.date ?? '').trim() ? p : { ...p, tx: { ...p.tx, date: caseData.caseDate } }));
  }, [caseData.caseDate]);

  const proc = TEMPLATES.find((t) => t.key === d.tx.proc);

  // Tapping the procedure or a particular re-writes the note from the
  // template — a declared act, like picking a new stamp. Typing in the note
  // box afterward edits freely and stands until the next tap.
  const regenerate = (t: Template, params: Params) => {
    const { date, time } = nowStamp();
    setD((p) => ({
      ...p,
      tx: {
        ...p.tx,
        proc: t.key,
        ...params,
        note: t.compose({ ...p.tx, ...params }),
        date: (p.tx.date ?? '').trim() || date,
        time: (p.tx.time ?? '').trim() || time,
      },
    }));
    // A standalone procedure prints the note and the billing sheet: picking
    // the procedure names it on the case (billing reads that) and drops its
    // CPT into billing's add-a-code box while the box is blank.
    setCaseField('procedure', t.procName);
    if (!(readSheet(BILLING_KEY).tx.addCode ?? '').trim()) writeSheetTx(BILLING_KEY, 'addCode', t.cpt);
    onDraftsChanged?.();
  };

  const chip = (active: boolean, onClick: () => void, label: string, key?: string) => (
    <button key={key ?? label} type="button" className={`chip${active ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );

  const stampSig = (sig: string) => {
    const { date, time } = nowStamp();
    setD((p) => ({ ...p, tx: { ...p.tx, sigImg: sig, sigDate: date, sigTime: time, sigName: signer.name || signer.initials } }));
  };

  return (
    <>
      <div className="intake screen-only pn-composer">
        <div className="igroup">
          <span>Procedure</span>
          <div className="chips wrap">
            {TEMPLATES.map((t) => chip(d.tx.proc === t.key, () => regenerate(t, {}), t.label, t.key))}
          </div>
        </div>
        {proc?.params.map(({ k, label, opts }) => (
          <div className="igroup" key={k}>
            <span>{label}</span>
            <div className="chips wrap">
              {opts.map((o) => chip(d.tx[k] === o, () => regenerate(proc, { [k]: o }), o, k + o))}
            </div>
          </div>
        ))}
        <div className="irow">
          <label className="ifield">
            <span>Date</span>
            <input {...datePad} value={d.tx.date ?? ''} onChange={(e) => setTx('date', e.target.value)} />
          </label>
          <label className="ifield">
            <span>Time</span>
            <input {...timePad} value={d.tx.time ?? ''} placeholder="HHMM" onChange={(e) => setTx('time', e.target.value)} />
          </label>
        </div>
        <div className="chips">
          <button
            type="button"
            className="chip on"
            onClick={() => (signer.signature ? stampSig(signer.signature) : setPadOpen(true))}
          >
            {d.tx.sigImg ? '↻ Re-sign' : signer.signature ? `✍ Sign as ${signer.name || signer.initials}` : '✍ Sign'}
          </button>
          {d.tx.sigImg && (
            <button type="button" className="chip" onClick={() => setD((p) => ({ ...p, tx: { ...p.tx, sigImg: '', sigName: '' } }))}>
              Clear signature
            </button>
          )}
          <span className="awiz-switch-hint">Print prints the note and the billing sheet together — the chart copy and the billing copy.</span>
        </div>
        {padOpen && (
          <SignaturePad
            onSave={(sig) => {
              stampSig(sig);
              setPadOpen(false);
            }}
            onCancel={() => setPadOpen(false)}
          />
        )}
      </div>

      <div className="page pn-page">
        <div className="pn-top">
          <div className="bc-wrap">
            <Barcode39 value="PNRT" />
            <div className="bc-caption">*PNRT*</div>
          </div>
        </div>
        <div className="pn-box">
          <div className="pn-head">
            <span className="pn-hdate">Date</span>
            <span className="pn-htime">Time</span>
            <span className="pn-hnote">NOTES SHOULD BE SIGNED, DATED, AND TIMED</span>
          </div>
          <div className="pn-body">
            <div className="pn-datecol">{d.tx.date ?? ''}</div>
            <div className="pn-timecol">{d.tx.time ?? ''}</div>
            <div className="pn-notecol">
              <textarea
                {...noAuto}
                className="pn-note screen-only"
                rows={12}
                value={d.tx.note ?? ''}
                placeholder="Pick a procedure above, or write the note here."
                onChange={(e) => setTx('note', e.target.value)}
              />
              <div className="pn-notetext print-only-block">{d.tx.note ?? ''}</div>
              {d.tx.sigImg && (
                <div className="pn-sig">
                  <SigImg src={d.tx.sigImg} className="pn-sigimg" />
                  <span className="signame">{nameForSignature(d.tx.sigImg, d.tx.sigName)}</span>
                  <span className="pn-sigdt">{d.tx.sigDate} {d.tx.sigTime}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="po-foot">
          <div>
            <div className="b po-foottitle">Progress Notes</div>
            <div>QHC-NS-2505HMS&emsp;01/08 (Rev. 10/08, 12/09)</div>
          </div>
          <div className="po-footpage">Page 1 of 1</div>
          <div className="po-footlabel">Patient Label</div>
        </div>
        <div className="po-hospital">Mountain West Medical Center</div>
      </div>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { datePad, noAuto, numPad, timePad } from './inputProps';
import { useCaseData, setCaseField } from './caseData';
import Barcode39 from './Barcode39';
import SignatureStamp from './SignatureStamp';
import LearnedInput from './LearnedInput';
import { BLOCK_KEY } from './drafts';
import BlockWizard from './BlockWizard';

// Block Documentation replicating Mountain West Medical Center form
// 170-165-1130010HMS (09/09, Rev. 06/15), portrait US Letter, built from a
// flat scan of the original. Peripheral nerve blocks — mostly ortho. The
// sheet joins the printed packet as its own page on a block case.
// No patient identifiers — the label sticker is applied after printing.

interface BlockDraft {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
}

function loadBlock(): BlockDraft {
  try {
    const raw = localStorage.getItem(BLOCK_KEY);
    if (!raw) return { ck: {}, tx: {} };
    const parsed = JSON.parse(raw) as Partial<BlockDraft>;
    return { ck: parsed.ck ?? {}, tx: parsed.tx ?? {} };
  } catch {
    return { ck: {}, tx: {} };
  }
}

export function clearBlockDraft(): void {
  localStorage.removeItem(BLOCK_KEY);
}

const SITES = [
  ['interscalene', 'Interscalene'],
  ['axillaryBlk', 'Axillary'],
  ['femoral', 'Femoral'],
  ['sciatic', 'Sciatic'],
  ['infraclavicular', 'Infraclavicular'],
  ['supraclavicular', 'Supraclavicular'],
  ['popliteal', 'Popliteal'],
  ['contFnb', 'Cont FNB'],
] as const;

export default function BlockDoc({ resetSignal = 0 }: { resetSignal?: number }) {
  const [d, setD] = useState<BlockDraft>(loadBlock);
  const [mode, setMode] = useState<'form' | 'wizard'>('form');
  const caseData = useCaseData();

  useEffect(() => {
    localStorage.setItem(BLOCK_KEY, JSON.stringify(d));
  }, [d]);

  const seenReset = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== seenReset.current) {
      seenReset.current = resetSignal;
      setD(loadBlock());
      setMode('form');
    }
  }, [resetSignal]);

  // Touching the sheet is declaring the block: the case flags it so the
  // packet includes this page and the pre-print check asks about it.
  const declare = () => {
    if (!caseData.blockCase) setCaseField('blockCase', true);
  };
  const setCk = (k: string, v: boolean) => {
    declare();
    setD((p) => ({ ...p, ck: { ...p.ck, [k]: v } }));
  };
  const setTx = (k: string, v: string) => {
    declare();
    // Typing in the stimulator's "at" box takes it over from the auto-fill.
    setD((p) => ({ ...p, tx: { ...p.tx, [k]: v, ...(k === 'maAt1' ? { maAt1Auto: '' } : {}) } }));
  };

  // The case date is this sheet's date too, while its own box is blank.
  useEffect(() => {
    if (!caseData.caseDate) return;
    setD((p) => ((p.tx.date ?? '').trim() ? p : { ...p, tx: { ...p.tx, date: caseData.caseDate } }));
  }, [caseData.caseDate]);

  // The stimulator's "at" is the block itself — R Interscalene, L Femoral —
  // so it writes itself from the side and site picked, while its box is
  // blank. Typed text always stands.
  const sideAbbr = d.ck.sideRight ? 'R' : d.ck.sideLeft ? 'L' : '';
  const siteLabel = SITES.find(([k]) => d.ck[k])?.[1] ?? (d.ck.siteOtherCk ? (d.tx.siteOther ?? '').trim() : '');
  useEffect(() => {
    const at = [sideAbbr, siteLabel].filter(Boolean).join(' ');
    if (!at) return;
    setD((p) => {
      const cur = (p.tx.maAt1 ?? '').trim();
      // A value someone typed stands; one this auto-fill wrote keeps
      // following the side and site as they are picked.
      if (cur && p.tx.maAt1Auto !== '1') return p;
      if (cur === at) return p;
      return { ...p, tx: { ...p.tx, maAt1: at, maAt1Auto: '1' } };
    });
  }, [sideAbbr, siteLabel]);

  const ck = (k: string, label?: string) => (
    <label className="ck" key={k}>
      <input type="checkbox" checked={!!d.ck[k]} onChange={(e) => setCk(k, e.target.checked)} />
      {label && <span>{label}</span>}
    </label>
  );

  const tx = (k: string, cls = 'grow') => (
    <input {...noAuto} className={`t u ${cls}`} value={d.tx[k] ?? ''} onChange={(e) => setTx(k, e.target.value)} />
  );
  const txn = (k: string, cls = 'xshort') => (
    <input {...numPad} className={`t u ${cls}`} value={d.tx[k] ?? ''} onChange={(e) => setTx(k, e.target.value)} />
  );
  const txt = (k: string, cls = 'short') => (
    <input {...timePad} className={`t u ${cls}`} value={d.tx[k] ?? ''} onChange={(e) => setTx(k, e.target.value)} />
  );

  // One of a printed pair: ticking one clears its partner.
  const xck = (k: string, other: string, label: string) => (
    <label className="ck" key={k}>
      <input
        type="checkbox"
        checked={!!d.ck[k]}
        onChange={(e) => {
          setD((p) => ({ ...p, ck: { ...p.ck, [k]: e.target.checked, ...(e.target.checked ? { [other]: false } : {}) } }));
          declare();
        }}
      />
      <span>{label}</span>
    </label>
  );

  // The printed (+/–) pair: tap the sign that applies and it circles.
  const pm = (k: string, label: string) => (
    <span className="bd-pm" key={k}>
      {'('}
      <button
        type="button"
        className={`po-priw${d.ck[`${k}Pos`] ? ' on' : ''}`}
        onClick={() => setD((p) => ({ ...p, ck: { ...p.ck, [`${k}Pos`]: !p.ck[`${k}Pos`], [`${k}Neg`]: false } }))}
      >
        +
      </button>
      /
      <button
        type="button"
        className={`po-priw${d.ck[`${k}Neg`] ? ' on' : ''}`}
        onClick={() => setD((p) => ({ ...p, ck: { ...p.ck, [`${k}Neg`]: !p.ck[`${k}Neg`], [`${k}Pos`]: false } }))}
      >
        –
      </button>
      {') '}
      <span>{label}</span>
    </span>
  );

  // The catheter line's (☐+ ☐–) pairs.
  const pmck = (k: string, label: string) => (
    <span className="bd-pmck" key={k}>
      ({xck(`${k}Pos`, `${k}Neg`, '+')}{xck(`${k}Neg`, `${k}Pos`, '–')}) <span>{label}</span>
    </span>
  );

  if (mode === 'wizard') {
    return (
      <BlockWizard
        ck={d.ck}
        tx={d.tx}
        setCk={setCk}
        setTx={setTx}
        onBack={() => setMode('form')}
        onDone={() => setMode('form')}
      />
    );
  }

  return (
    <>
    <div className="awiz-switch screen-only">
      <button type="button" className="chip" onClick={() => setMode('wizard')}>⛑ Guided block wizard</button>
      <span className="awiz-switch-hint">Side, site, needle, injectate, findings, sign — made for a phone in the OR. The full form stays fillable.</span>
    </div>
    <div className="page bd-page">
      <div className="bd-top">
        <div className="bd-topck">
          <label className="ck">
            <input type="checkbox" checked={!!d.ck.timeout} onChange={(e) => setCk('timeout', e.target.checked)} />
            <span><b>Procedure Team verified During time out: Patient, Procedure and site.</b></span>
          </label>
          <label className="ck">
            <input type="checkbox" checked={!!d.ck.safeReview} onChange={(e) => setCk('safeReview', e.target.checked)} />
            <span><b>Safe Procedure Review Completed</b></span>
          </label>
        </div>
        <div className="bc-wrap">
          <Barcode39 value="PROHW" />
          <div className="bc-caption">*PROHW*</div>
        </div>
      </div>

      <div className="bd-form">
        <div className="bd-line">
          <span className="lbl">Date:</span>
          <input {...datePad} className="t u med" value={d.tx.date ?? ''} onChange={(e) => setTx('date', e.target.value)} />
          <span className="lbl">Time:</span>
          {txt('time')}
        </div>
        <div className="bd-line">
          <span className="lbl">Request for consultation by Dr.</span>
          <LearnedInput bucket="surgeon" className="t u grow" value={caseData.surgeon} onChange={(v) => { declare(); setCaseField('surgeon', v); }} />
        </div>
        <div className="bd-line">
          <span className="lbl">Surgical Procedure:</span>
          <LearnedInput bucket="procedure" className="t u grow" value={caseData.procedure} onChange={(v) => { declare(); setCaseField('procedure', v); }} />
        </div>
        <div className="bd-line">
          <span className="lbl">Indication:</span>
          {ck('postopPain', 'Post-operative pain')}
          {ck('opAnesthesia', 'Operative Anesthesia')}
        </div>
        <div className="bd-line">
          <span className="lbl">Block Start Time:</span>
          {txt('blockStart')}
          <span className="lbl">Block End Time:</span>
          {txt('blockEnd')}
        </div>
        <div className="bd-line bd-wrapline">
          <span className="lbl">Block Employed:</span>
          {xck('sideRight', 'sideLeft', 'Right')}
          {xck('sideLeft', 'sideRight', 'Left')}
          {SITES.map(([k, label]) => ck(k, label))}
          {ck('siteOtherCk', 'Other')}
          {tx('siteOther', 'short')}
        </div>

        <div className="bd-sec">
          <span className="bd-seclbl">Patient:</span>
          <div className="bd-secbody">
            {ck('consent', 'Consent – Risks and Benefits discussed.')}
            <div className="bd-risks">
              Risks to this regional anesthetic were discussed with the patient, including bleeding, bruising,
              swelling, infection, nerve injury, permanent or temporary nerve damage, headache, possibility
              of no pain relief and pneumothorax. All of the patient's questions were answered.
            </div>
            <div className="bd-line">{tx('rnName', 'med')} <span>RN present for timeout and throughout procedure.</span></div>
          </div>
        </div>
        <div className="bd-sec">
          <span className="bd-seclbl">Monitors</span>
          <div className="bd-secbody bd-line">{ck('ekg', 'EKG')}{ck('spo2', 'SpO₂')}{ck('nibp', 'NIBP')}</div>
        </div>
        <div className="bd-sec">
          <span className="bd-seclbl">Prep:</span>
          <div className="bd-secbody bd-line">
            {ck('betadine', 'Betadine')}
            {ck('alcohol', 'Alcohol')}
            {ck('chlorhexidine', 'Chlorhexidine/Alcohol')}
            {ck('duraprep', 'DuraPrep')}
          </div>
        </div>
        <div className="bd-sec">
          <span className="bd-seclbl">IV sedation:</span>
          <div className="bd-secbody bd-line">
            {xck('sedNo', 'sedYes', 'No')}
            {xck('sedYes', 'sedNo', 'Yes')}
            <span>Versed</span>{txn('versed')}<span>mg</span>
            <span>Fentanyl</span>{txn('fentanylSed')}<span>mcg</span>
          </div>
        </div>
        <div className="bd-sec">
          <span className="bd-seclbl">Needle:</span>
          <div className="bd-secbody bd-line">
            <span>Stimuplex</span>
            {ck('tuohy18', '18-gauge Tuohy 2/4 inch')}
            {ck('gauge22', '22-gauge 2/4 inch')}
            {ck('needleOtherCk', 'Other')}
            {tx('needleOther', 'short')}
          </div>
        </div>
        <div className="bd-sec">
          <span className="bd-seclbl">Nerve Stimulator:</span>
          <div className="bd-secbody">
            <div className="bd-line"><span>Used/minimum Current range (mA):</span>{tx('ma1', 'grow')}<span>at</span>{tx('maAt1', 'med')}</div>
            <div className="bd-line"><span>Used/minimum Current range (mA):</span>{tx('ma2', 'grow')}<span>at</span>{tx('maAt2', 'med')}</div>
          </div>
        </div>
        <div className="bd-sec">
          <span className="bd-seclbl">Plexus (nerve):</span>
          <div className="bd-secbody">
            <div className="bd-line bd-wrapline">
              {pm('aspiration', 'Aspiration test')}
              {pm('testDose', 'Test dose')}
              {pm('paresNeedle', 'Paresthesia with needle placement')}
            </div>
            <div className="bd-line bd-wrapline">
              {pm('paresInjection', 'Parasthesia with injection')}
              {pm('paresCatheter', 'pain/parasthesia with catheter')}
            </div>
          </div>
        </div>
        <div className="bd-sec">
          <span className="bd-seclbl">Injectate: (incremental):</span>
          <div className="bd-secbody">
            <div className="bd-line"><span>Ropivacaine</span>{txn('ropiPct')}<span>%</span><span>Volume</span>{txn('ropiVol', 'short')}</div>
            <div className="bd-line">{ck('injOtherCk', 'Other')}{tx('injOther', 'med')}{txn('injOtherPct')}<span>%</span><span>Volume</span>{txn('injOtherVol', 'short')}</div>
          </div>
        </div>
        <div className="bd-sec">
          <span className="bd-seclbl">Catheter:</span>
          <div className="bd-secbody">
            <div className="bd-line">{ck('cathSterile', 'Placed under sterile technique, catheter inserted to')}{txn('cathCm')}<span>cm at skin.</span></div>
            <div className="bd-line">{ck('tunneled', 'Tunneled')}{ck('steriStrips', 'Secured with Steri-Strips sterile dressing applied.')}</div>
            <div className="bd-line">{ck('flushed', 'After catheter secured, it was flushed and aspirated.')}</div>
            <div className="bd-line bd-wrapline">
              {pmck('heme', 'heme,')}
              {pmck('ivSymptoms', 'symptoms of IV injection,')}
              {pmck('painInjection', 'pain on injection.')}
            </div>
          </div>
        </div>

        <div className="bd-plans">
          <span className="lbl">Plans/Comments:</span> Injection was made incrementally with aspiration every 5 mL. No sharp pain was elicited during
          injection. The patient tolerated the procedure well.
          <textarea
            {...noAuto}
            className="a bd-comments"
            rows={3}
            value={d.tx.comments ?? ''}
            onChange={(e) => setTx('comments', e.target.value)}
          />
        </div>

        <div className="bd-sign">
          <SignatureStamp
            label="Provider Signature"
            sig={d.tx.sigImg ?? ''}
            date={d.tx.sigDate ?? ''}
            time={d.tx.sigTime ?? ''}
            name={d.tx.sigName ?? ''}
            onStamp={(s, dt, tm, nm) => {
              declare();
              setD((p) => ({ ...p, tx: { ...p.tx, sigImg: s, sigDate: dt, sigTime: tm, sigName: nm } }));
            }}
            onClear={() => setD((p) => ({ ...p, tx: { ...p.tx, sigImg: '', sigName: '' } }))}
          />
        </div>
      </div>

      <div className="po-foot">
        <div>
          <div className="b po-foottitle">Block Documentation</div>
          <div>170-165-1130010HMS&emsp;09/09 (Rev. 06/15)</div>
          <div>ORIGINAL – Medical Record&emsp;COPY – Pharmacy</div>
          <div>COPY – Anesthesia</div>
        </div>
        <div className="po-footpage">Page 1 of 1</div>
        <div className="po-footlabel">Patient Label</div>
      </div>
      <div className="po-hospital">Mountain West Medical Center</div>
    </div>
    </>
  );
}

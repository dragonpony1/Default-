import { useEffect, useRef, useState, type ReactNode } from 'react';
import { noAuto, numPad } from './inputProps';
import { useCaseData, setCaseField } from './caseData';
import Barcode39 from './Barcode39';
import PacuWizard from './PacuWizard';
import SignatureStamp from './SignatureStamp';

// Post-Anesthesia Recovery Room Orders replicating Mountain West Medical
// Center form 170-165-1131001HMSFAC (01/15, Rev. 07/15, 07/22), portrait US
// Letter, built from a flat scan of the original. Dose blanks and priority
// checkboxes are fillable on screen; the printed page matches the paper form.
// No patient identifiers — the label sticker is applied after printing.

const KEY = 'pacu-orders-draft-v1';

interface PacuDraft {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
}

function loadPacu(): PacuDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ck: {}, tx: {} };
    const parsed = JSON.parse(raw) as Partial<PacuDraft>;
    return { ck: parsed.ck ?? {}, tx: parsed.tx ?? {} };
  } catch {
    return { ck: {}, tx: {} };
  }
}

export function clearPacuDraft(): void {
  localStorage.removeItem(KEY);
}

// PACU orders are standing orders — the same doses, case after case — so
// clearing the forms for the next patient keeps them and drops only what
// belonged to the patient just finished: the signature and its date and time.
export function clearPacuForNextCase(): void {
  const d = loadPacu();
  if (!Object.keys(d.ck).length && !Object.keys(d.tx).length) return;
  const tx = { ...d.tx };
  delete tx.sigImg;
  delete tx.sigName;
  delete tx.date;
  delete tx.time;
  localStorage.setItem(KEY, JSON.stringify({ ck: d.ck, tx }));
}

export default function PacuOrders({ resetSignal = 0 }: { resetSignal?: number }) {
  const [d, setD] = useState<PacuDraft>(loadPacu);
  const [mode, setMode] = useState<'form' | 'wizard'>('form');
  const caseData = useCaseData(); // shared allergies (pre-populated from pre-op)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(d));
  }, [d]);

  const seenReset = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== seenReset.current) {
      seenReset.current = resetSignal;
      setD(loadPacu());
      setMode('form');
    }
  }, [resetSignal]);

  const setCkVal = (k: string, v: boolean) => setD((p) => ({ ...p, ck: { ...p.ck, [k]: v } }));
  const setTxVal = (k: string, v: string) => setD((p) => ({ ...p, tx: { ...p.tx, [k]: v } }));

  if (mode === 'wizard') {
    return (
      <PacuWizard
        ck={d.ck}
        tx={d.tx}
        setCk={setCkVal}
        setTx={setTxVal}
        allergies={caseData.allergies}
        setAllergies={(v) => setCaseField('allergies', v)}
        weight={caseData.weight}
        weightKg={caseData.weightKg}
        height={caseData.height}
        setWeight={(v) => setCaseField('weight', v)}
        setWeightKg={(v) => setCaseField('weightKg', v)}
        setHeight={(v) => setCaseField('height', v)}
        onBack={() => setMode('form')}
        onDone={() => setMode('form')}
      />
    );
  }

  const ck = (k: string) => (
    <input
      type="checkbox"
      checked={!!d.ck[k]}
      onChange={(e) => setD((p) => ({ ...p, ck: { ...p.ck, [k]: e.target.checked } }))}
    />
  );

  const txn = (k: string, cls = 'xshort') => (
    <input
      {...numPad}
      className={`t u ${cls}`}
      value={d.tx[k] ?? ''}
      onChange={(e) => setD((p) => ({ ...p, tx: { ...p.tx, [k]: e.target.value } }))}
    />
  );

  const tx = (k: string, cls = 'xshort') => (
    <input
      {...noAuto}
      className={`t u ${cls}`}
      value={d.tx[k] ?? ''}
      onChange={(e) => setD((p) => ({ ...p, tx: { ...p.tx, [k]: e.target.value } }))}
    />
  );

  // Items with no dose blank (standing orders) can be "circled" to mark them
  // active, the way you'd circle the order number on paper.
  const item = (n: number, body: ReactNode, circle = false) => (
    <div className="po-item" key={n}>
      {circle ? (
        <button
          type="button"
          className={`po-num po-circle${d.ck[`circle${n}`] ? ' on' : ''}`}
          onClick={() => setD((p) => ({ ...p, ck: { ...p.ck, [`circle${n}`]: !p.ck[`circle${n}`] } }))}
        >
          {n}.
        </button>
      ) : (
        <span className="po-num">{n}.</span>
      )}
      <div className="po-body">{body}</div>
    </div>
  );

  const sub = (letter: string, text: string) => (
    <div className="po-sub" key={letter}>
      <span className="po-let">{letter}.</span>
      <span>{text}</span>
    </div>
  );

  return (
    <>
      <div className="awiz-switch screen-only">
        <button type="button" className="chip" onClick={() => setMode('wizard')}>⛑ Guided PACU wizard</button>
        <span className="awiz-switch-hint">Walks you through the standing orders and doses. The full form stays fillable.</span>
      </div>
    <div className="page po-page">
      <div className="page-top">
        <div className="bc-wrap">
          <Barcode39 value="PO" />
          <div className="bc-caption">*PO*</div>
        </div>
      </div>

      <div className="po-form">
        <div className="po-brand">
          <label className="ck">
            {ck('noSubstitution')}
            <span>Another brand of drug identical in form and content may be dispensed unless checked</span>
          </label>
        </div>

        {item(1, (
          <div className="po-line">
            <span>Patient allergies:</span>
            <input
              {...noAuto}
              className="t u grow"
              value={caseData.allergies}
              onChange={(e) => setCaseField('allergies', e.target.value)}
            />
            <span>Patient Wt</span>
            <input {...numPad} className="t u xshort" value={caseData.weight} onChange={(e) => setCaseField('weight', e.target.value)} />
            <span>(kg)</span>
            <input {...numPad} className="t u xshort" value={caseData.weightKg} onChange={(e) => setCaseField('weightKg', e.target.value)} />
            <span>Ht</span>
            <input {...numPad} className="t u short" value={caseData.height} onChange={(e) => setCaseField('height', e.target.value)} />
          </div>
        ))}
        {item(2, (
          <>
            <div>Post Anesthesia:</div>
            {sub('A', 'Titrate supplemental oxygen with simple face mask or nasal cannula.')}
            {sub('B', 'Discontinue oxygen if Sats are greater than 92% on room air.')}
            {sub('C', 'Do not administer medications if patient has known allergies to the ordered medications.')}
            {sub('D', 'Do not administer narcotics if patient has respiratory rate less then 10 breaths/minute.')}
            {sub('E', 'Do not administer narcotics if patient Sats are less than 90%.')}
            {sub('F', "Do not administer narcotics if patient's Systolic blood pressure is below 90 or Diastolic is below 60.")}
            {sub('G', 'Please check blood sugar on all diabetic patients. Please call anesthesia provider if blood sugar is below 80 mg/dL or greater than 200 mg/dL.')}
          </>
        ), true)}

        <div className="po-sechead">PAIN</div>
        {item(3, (
          <>
            <div className="po-line">
              <span>Toradol (Ketoralac)</span>
              {txn('toradolLow')}
              <span>mg (pain scale 1-5) to</span>
              {txn('toradolHigh')}
              <span>mg (pain scale 6-10) times 1 PRN post-operative IV/IM pain.</span>
            </div>
            <div className="po-or">~OR~</div>
          </>
        ))}
        {item(4, '800 mg Ibuprofen IV diluted in 250 mL Normal Saline run over 30 minutes times 1 PRN post-operative pain.')}

        <div className="po-sechead flush">PACU nurse may administer one dose of one of the following oral pain medications:</div>
        {item(5, (
          <>
            <div className="po-line">
              <span>Lortab (Hydrocodone)</span>
              {txn('lortab')}
              <span>mg 1 tablet/Elixir (pain scale 1-5) to 2 tablets (pain scale 6-10) PO PRN post-operative pain times 1 dose.</span>
            </div>
            <div className="po-or">~OR~</div>
          </>
        ))}
        {item(6, (
          <div className="po-line">
            <span>Percocet (Oxycodone)</span>
            {txn('percocet')}
            <span>mg 1 tablet (pain scale 1-5) to 2 tablets (pain scale 6-10) PO PRN post-operative pain times 1 dose.</span>
          </div>
        ))}

        <div className="po-sechead">BREAKTHROUGH PAIN (if choosing more than one medication, priority must be checked)</div>
        {item(7, (
          <div className="po-line">
            {ck('morphine')}
            <span>Morphine Sulfate (Duramorph)</span>
            {txn('morphineLow')}
            <span>mg (pain scale 3-5) to</span>
            {txn('morphineHigh')}
            <span>mg (pain scale 6-10) IV every</span>
            {txn('morphineEvery')}
            <span>minutes PRN post-operative pain. Maximum dose of</span>
            {txn('morphineMax')}
            <span>mg (first, second, third)</span>
          </div>
        ))}
        {item(8, (
          <div className="po-line">
            {ck('dilaudid')}
            <span>Dilaudid (Hydromorphone)</span>
            {txn('dilaudidLow')}
            <span>mg (pain scale 3-5)</span>
            {txn('dilaudidHigh')}
            <span>mg (pain scale 6-10) IV every</span>
            {txn('dilaudidEvery')}
            <span>minutes PRN post-operative pain. Maximum dose of</span>
            {txn('dilaudidMax')}
            <span>mg (first, second, third)</span>
          </div>
        ))}
        {item(9, (
          <div className="po-line">
            {ck('fentanyl')}
            <span>Fentanyl (Sublimaze)</span>
            {txn('fentanylLow')}
            <span>mcg (pain scale 3-5)</span>
            {txn('fentanylHigh')}
            <span>mcg (pain scale 6-10) IV every</span>
            {txn('fentanylEvery')}
            <span>minutes PRN post-operative pain. Maximum dose of</span>
            {txn('fentanylMax')}
            <span>mcg (first, second, third)</span>
          </div>
        ))}

        <div className="po-sechead">NAUSEA AND SHIVERING</div>
        {item(10, (
          <div className="po-line">
            <span>Zofran (Ondansetron)</span>
            {txn('zofran')}
            <span>mg IV PRN post-operative nausea/vomiting may repeat times 1 15 minutes after first dose. (first, second)</span>
          </div>
        ))}
        {item(11, (
          <div className="po-line">
            <span>Reglan (Metoclopramide)</span>
            {txn('reglan')}
            <span>mg IV PRN post-operative nausea/vomiting may repeat times 1 15 minutes after first dose. (first, second)</span>
          </div>
        ))}
        {item(12, (
          <div className="po-line">
            <span>Inapsine (Droperidol)</span>
            {txn('inapsine')}
            <span>mg IV PRN post-operative nausea/vomiting may repeat times 1 15 minutes after first dose. (first, second)</span>
          </div>
        ))}
        {item(13, (
          <>
            <div>Call/Contact Anesthesia if:</div>
            {sub('a', 'Persistent/unrelieved post-operative pain (score greater than 5)')}
            {sub('b', 'Persistent nausea/vomiting')}
            {sub('c', 'Mean BP less than 55 mm Hg')}
            {sub('d', 'SaO₂ less than 90%')}
            {sub('e', 'Oxygen requirements greater than 8 liters by facemask')}
            {sub('f', 'Ventilatory rate less than 10 breaths/minute')}
            {sub('g', 'Unresponsiveness after narcotic analgesic dosing')}
          </>
        ), true)}
        {item(14, 'Discharge when MWMC PACU criteria met', true)}
        {item(15, 'Incentive Spirometer if patient alert and room air Sats are less than 90%', true)}
        {item(16, tx('line16', 'grow'))}
        {item(17, tx('line17', 'grow'))}
        {item(18, tx('line18', 'grow'))}
      </div>

      <div className="po-sign">
        <div className="po-sigcell grow">
          <SignatureStamp
            label="Anesthesia Provider"
            sig={d.tx.sigImg ?? ''}
            date={d.tx.date ?? ''}
            time={d.tx.time ?? ''}
            name={d.tx.sigName ?? ''}
            onStamp={(s, dt, tm, nm) => setD((p) => ({ ...p, tx: { ...p.tx, sigImg: s, date: dt, time: tm, sigName: nm } }))}
            onClear={() => setD((p) => ({ ...p, tx: { ...p.tx, sigImg: '', sigName: '' } }))}
          />
        </div>
      </div>

      <div className="po-foot">
        <div>
          <div className="b po-foottitle">Post-Anesthesia Recovery Room Orders</div>
          <div>170-165-1131001HMSFAC</div>
          <div>01/15 (Rev. 07/15, 07/22)</div>
        </div>
        <div className="po-footpage">Page 1 of 1</div>
        <div className="po-footlabel">Patient Label</div>
      </div>
      <div className="po-hospital">Mountain West Medical Center</div>
    </div>
    </>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { noAuto, numPad } from './inputProps';
import { useCaseData, setCaseField } from './caseData';
import Barcode39 from './Barcode39';
import PacuWizard from './PacuWizard';
import SignatureStamp from './SignatureStamp';
import LearnedInput from './LearnedInput';
import { learned, remember } from './learned';

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
  const [addOrder, setAddOrder] = useState(false);
  const [orderText, setOrderText] = useState('');
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

  // The case date — set on the record or by signing the pre-op — is the date
  // on these orders too, so the printed form is never undated. Signing still
  // stamps its own date and time over a blank.
  useEffect(() => {
    if (!caseData.caseDate) return;
    setD((p) => ((p.tx.date ?? '').trim() ? p : { ...p, tx: { ...p.tx, date: caseData.caseDate } }));
  }, [caseData.caseDate]);

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

  // The form's election boxes: writing a dose into an order checks the box
  // next to it, the way a chosen order is marked by hand. The box can also be
  // ticked on its own (item 4 has no dose blank); while a dose is written the
  // order stays elected, so the tick cannot be lost by accident.
  const electCk = (k: string, doseKeys: string[]) => {
    const elected = doseKeys.some((dk) => (d.tx[dk] ?? '').trim() !== '');
    return (
      <input
        type="checkbox"
        checked={!!d.ck[k] || elected}
        onChange={(e) => setCkVal(k, e.target.checked)}
      />
    );
  };

  // Third argument marks the order: an election checkbox node, or `true` on
  // the dose-less standing orders (items 2, 13, 14, 15), whose number can be
  // "circled" the way it is circled on paper. The empty election span keeps
  // every number in one column.
  const item = (n: number, body: ReactNode, elect?: ReactNode) => (
    <div className="po-item" key={n}>
      <span className="po-electbox">{elect === true ? null : elect}</span>
      {elect === true ? (
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

  // The "(first, second, third)" at the end of an order is the anesthesia
  // provider's ranking for the PACU nurse: circle which drug to give first.
  // Each word is tappable and circles like the standing-order numbers. One
  // priority per line (circling second lets go of first), and one line per
  // priority — giving fentanyl "first" takes "first" off the other narcotics
  // in its group, the way it could only be circled once on paper.
  const PAIN_PRI = ['morphinePri', 'dilaudidPri', 'fentanylPri'];
  const NAUSEA_PRI = ['zofranPri', 'reglanPri', 'inapsinePri'];
  const priority = (k: string, words: string[], group: string[]) => (
    <span className="po-pri">
      {'('}
      {words.map((w, i) => (
        <span key={w}>
          <button
            type="button"
            className={`po-priw${d.ck[k + w] ? ' on' : ''}`}
            onClick={() =>
              setD((p) => {
                const ckn = { ...p.ck };
                const on = !ckn[k + w];
                for (const o of words) delete ckn[k + o];
                for (const g of group) delete ckn[g + w];
                if (on) ckn[k + w] = true;
                return { ...p, ck: ckn };
              })
            }
          >
            {w}
          </button>
          {i < words.length - 1 ? ', ' : ''}
        </span>
      ))}
      {')'}
    </span>
  );

  // The first blank of the three write-in lines at the bottom.
  const freeLine = ['line16', 'line17', 'line18'].find((k) => !(d.tx[k] ?? '').trim());
  const rememberedOrders = learned('pacuOrder').slice(0, 8);

  return (
    <>
      <div className="awiz-switch screen-only">
        <button type="button" className="chip" onClick={() => setMode('wizard')}>⛑ Guided PACU wizard</button>
        <button type="button" className="chip" onClick={() => setAddOrder(true)}>💉 Add an order</button>
        <span className="awiz-switch-hint">Walks you through the standing orders and doses. The full form stays fillable.</span>
      </div>
      {addOrder && (
        <div className="sigpad-backdrop" onClick={() => setAddOrder(false)}>
          <div className="qd-panel" onClick={(e) => e.stopPropagation()}>
            <div className="qd-title">💉 Add an order</div>
            <div className="igroup">
              <span>Order</span>
              {rememberedOrders.length > 0 && (
                <div className="chips wrap">
                  {rememberedOrders.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`chip${orderText === v ? ' on' : ''}`}
                      onClick={() => setOrderText(orderText === v ? '' : v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
              <LearnedInput
                bucket="pacuOrder"
                className="qd-input"
                placeholder="e.g. Tylenol 1000 mg PO times 1 PRN pain…"
                value={orderText}
                onChange={setOrderText}
              />
            </div>
            <p className="ihint">
              {freeLine
                ? `Goes on line ${freeLine.replace('line', '')} and checks its box. It's remembered for next time.`
                : 'All three write-in lines are full — clear one to add another order.'}
            </p>
            <div className="qd-actions">
              <button type="button" className="chip" onClick={() => setAddOrder(false)}>Cancel</button>
              <button
                type="button"
                className="chip on qd-give"
                disabled={!orderText.trim() || !freeLine}
                onClick={() => {
                  const v = orderText.trim();
                  remember('pacuOrder', v);
                  setD((p) => ({ ...p, tx: { ...p.tx, [freeLine as string]: v } }));
                  setOrderText('');
                  setAddOrder(false);
                }}
              >
                ✓ Add to the orders
              </button>
            </div>
          </div>
        </div>
      )}
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
        ), electCk('item3', ['toradolLow', 'toradolHigh']))}
        {item(4, '800 mg Ibuprofen IV diluted in 250 mL Normal Saline run over 30 minutes times 1 PRN post-operative pain.', electCk('item4', []))}

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
        ), electCk('item5', ['lortab']))}
        {item(6, (
          <div className="po-line">
            <span>Percocet (Oxycodone)</span>
            {txn('percocet')}
            <span>mg 1 tablet (pain scale 1-5) to 2 tablets (pain scale 6-10) PO PRN post-operative pain times 1 dose.</span>
          </div>
        ), electCk('item6', ['percocet']))}

        <div className="po-sechead">BREAKTHROUGH PAIN (if choosing more than one medication, priority must be checked)</div>
        {item(7, (
          <div className="po-line">
            {electCk('morphine', ['morphineLow', 'morphineHigh', 'morphineEvery', 'morphineMax'])}
            <span>Morphine Sulfate (Duramorph)</span>
            {txn('morphineLow')}
            <span>mg (pain scale 3-5) to</span>
            {txn('morphineHigh')}
            <span>mg (pain scale 6-10) IV every</span>
            {txn('morphineEvery')}
            <span>minutes PRN post-operative pain. Maximum dose of</span>
            {txn('morphineMax')}
            <span>mg</span>
            {priority('morphinePri', ['first', 'second', 'third'], PAIN_PRI)}
          </div>
        ))}
        {item(8, (
          <div className="po-line">
            {electCk('dilaudid', ['dilaudidLow', 'dilaudidHigh', 'dilaudidEvery', 'dilaudidMax'])}
            <span>Dilaudid (Hydromorphone)</span>
            {txn('dilaudidLow')}
            <span>mg (pain scale 3-5)</span>
            {txn('dilaudidHigh')}
            <span>mg (pain scale 6-10) IV every</span>
            {txn('dilaudidEvery')}
            <span>minutes PRN post-operative pain. Maximum dose of</span>
            {txn('dilaudidMax')}
            <span>mg</span>
            {priority('dilaudidPri', ['first', 'second', 'third'], PAIN_PRI)}
          </div>
        ))}
        {item(9, (
          <div className="po-line">
            {electCk('fentanyl', ['fentanylLow', 'fentanylHigh', 'fentanylEvery', 'fentanylMax'])}
            <span>Fentanyl (Sublimaze)</span>
            {txn('fentanylLow')}
            <span>mcg (pain scale 3-5)</span>
            {txn('fentanylHigh')}
            <span>mcg (pain scale 6-10) IV every</span>
            {txn('fentanylEvery')}
            <span>minutes PRN post-operative pain. Maximum dose of</span>
            {txn('fentanylMax')}
            <span>mcg</span>
            {priority('fentanylPri', ['first', 'second', 'third'], PAIN_PRI)}
          </div>
        ))}

        <div className="po-sechead">NAUSEA AND SHIVERING</div>
        {item(10, (
          <div className="po-line">
            <span>Zofran (Ondansetron)</span>
            {txn('zofran')}
            <span>mg IV PRN post-operative nausea/vomiting may repeat times 1 15 minutes after first dose.</span>
            {priority('zofranPri', ['first', 'second'], NAUSEA_PRI)}
          </div>
        ), electCk('item10', ['zofran']))}
        {item(11, (
          <div className="po-line">
            <span>Reglan (Metoclopramide)</span>
            {txn('reglan')}
            <span>mg IV PRN post-operative nausea/vomiting may repeat times 1 15 minutes after first dose.</span>
            {priority('reglanPri', ['first', 'second'], NAUSEA_PRI)}
          </div>
        ), electCk('item11', ['reglan']))}
        {item(12, (
          <div className="po-line">
            <span>Inapsine (Droperidol)</span>
            {txn('inapsine')}
            <span>mg IV PRN post-operative nausea/vomiting may repeat times 1 15 minutes after first dose.</span>
            {priority('inapsinePri', ['first', 'second'], NAUSEA_PRI)}
          </div>
        ), electCk('item12', ['inapsine']))}
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
        {item(16, tx('line16', 'grow'), electCk('item16', ['line16']))}
        {item(17, tx('line17', 'grow'), electCk('item17', ['line17']))}
        {item(18, tx('line18', 'grow'), electCk('item18', ['line18']))}
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

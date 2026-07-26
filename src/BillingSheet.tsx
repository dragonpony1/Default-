import { useEffect, useRef, useState } from 'react';
import { noAuto } from './inputProps';
import BillingWizard from './BillingWizard';
import { useSigner, nowStamp } from './signer';

// Deseret Peak Anesthesia Billing Information sheet, built from a flat scan
// of the original. Tap the box beside a CPT code to mark it; header fields
// and the add-a-code blank are fillable. Prints on a single US Letter page.
// No patient identifiers — the Pt Label sticker is applied after printing.

const KEY = 'billing-sheet-draft-v1';

export type Code = [code: string, desc: string];

const LEFT: Code[] = [
  ['00126', 'BMT (PE tubes)'],
  ['00142', 'CELI (cataract surgery)'],
  ['00160', 'Septoplasty, FESS, sinus surgery'],
  ['00170', 'Tonsillectomy, adenoidectomy, dental rehab'],
  ['00300', 'Facial lesions, head & neck lipomas, skin lesions on back'],
  ['00320', 'Thyroidectomy, direct laryngoscopy, tracheostomy'],
  ['00400', 'Any skin lesion EXCEPT of the head, neck or posterior trunk, breast biopsy'],
  ['00450', 'Clavicle fracture'],
  ['00532', 'Porta Cath'],
  ['00600', 'Procedures on Cervical spine'],
  ['00620', 'Procedure on Thorasic spine cord'],
  ['00630', 'Procedure on Lumbar and Sacrum'],
  ['00670', 'Surgery on more then 1 level'],
  ['00731', 'EGD'],
  ['00790', 'Explor & Dx Lap, Lap Chole, Nissen Fundiplication'],
  ['00800', 'Lower anterior abdominal wall procedure'],
  ['00811', 'When Colonoscopy is a diagnostic procedure'],
  ['00812', 'Colonoscopy Screening procedure'],
  ['00813', 'EGD & Colonoscopy'],
  ['00830', 'Inguinal hernia, femoral hernia'],
  ['00832', 'Umbilical / Ventral hernia'],
  ['00840', 'Appendectomy, laparoscopic hernia repair, PPTL, ovarian cystectomy, TAH, TLH, Supra pubic cath'],
  ['00846', 'Radical hysterectomy'],
  ['00851', 'Tubal Ligation'],
  ['00872', 'ESWL/Water'],
  ['00902', 'Hemorrhoids, pilonidal cysts, Prostate Bx'],
  ['00910', 'Cystoscopy, stent placement, Ureteroscopy'],
  ['00912', 'TURBT'],
  ['00914', 'TURP'],
  ['00916', 'Post-TURP bleeding'],
  ['00918', 'Kidney stone extraction'],
  ['00920', 'Circumcision'],
  ['00930', 'Orchiopexy'],
  ['00940', 'D&C vaginal procedures'],
  ['00942', 'Anterior / posterior vaginal repair, Hydrocelectomy'],
  ['00944', 'Vaginal hysterectomy'],
  ['00948', 'Cervical cerclage'],
  ['00952', 'Hysteroscopy'],
  ['01200', 'Closed hip reduction or manipulation'],
];

const RIGHT_TOP: Code[] = [
  ['01210', 'Open Hip Fracture'],
  ['01214', 'Total hip replacements, bipolar hip prosthesis'],
  ['01215', 'Revision total hip replacement'],
  ['01320', 'ACL'],
  ['01380', 'Knee manipulation'],
  ['01400', 'Knee arthroscopy, open knee'],
  ['01402', 'Total Knee arthroplasty'],
  ['01464', 'Ankle or foot arthoscopy'],
  ['01470', 'Neuroma / soft tissue foot'],
  ['01472', 'Ruptured Achilles Tendon'],
  ['01474', 'Gastroc Recession'],
  ['01480', 'Bones of foot Bunion, hammer toe, ankle fx'],
  ['01610', 'Rotator cuff repair'],
  ['01620', 'Shoulder manipulation'],
  ['01630', 'Shoulder arthroscopy / open shoulder'],
  ['01638', 'Total Shoulder arthroplasty'],
  ['01740', 'Open Elbow Procedure / Elbow Arthroscopy'],
  ['01810', 'Carpal Tunnel, tendon, hand, wrist neuroma'],
  ['01820', 'Wrist closed reduction'],
  ['01830', 'ORIF hand, wrist, forearm'],
];

const RIGHT_BOTTOM: Code[] = [
  ['76942', 'Ultra Sound'],
  ['64415-59', 'Inter scalene'],
  ['64418-59', 'Supra Clavicular'],
  ['64417-59', 'Axillary'],
  ['64486-59', 'Trans Abdominal Plane'],
  ['64447-59', 'Femoral/Adductor'],
  ['64446-59', 'Popliteal / Sciatic'],
  ['62322-59', 'SAB Duramorph'],
  ['62270', 'Lumbar puncture Diagnostic'],
  ['76937', 'Ultra Sound IV Placement'],
  ['36410', 'IV Start'],
  ['36620', 'Arterial Catheterization'],
  ['31500', 'Emergency Intubation'],
  ['99140', 'Emergency after hrs'],
];

// Procedure/anesthesia CPT codes (left + ortho columns) and the block/line
// codes, exported so the guided wizard can search and check the same codes.
export const PROCEDURE_CODES: Code[] = [...LEFT, ...RIGHT_TOP];
export const BLOCK_CODES: Code[] = RIGHT_BOTTOM;

interface BillingDraft {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
}

function loadBilling(): BillingDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ck: {}, tx: {} };
    const parsed = JSON.parse(raw) as Partial<BillingDraft>;
    return { ck: parsed.ck ?? {}, tx: parsed.tx ?? {} };
  } catch {
    return { ck: {}, tx: {} };
  }
}

export function clearBillingDraft(): void {
  localStorage.removeItem(KEY);
}

export default function BillingSheet({ resetSignal = 0 }: { resetSignal?: number }) {
  const [d, setD] = useState<BillingDraft>(loadBilling);
  const [mode, setMode] = useState<'form' | 'wizard'>('form');
  const signer = useSigner();

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(d));
  }, [d]);

  const seenReset = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== seenReset.current) {
      seenReset.current = resetSignal;
      setD(loadBilling());
      setMode('form');
    }
  }, [resetSignal]);

  const setCkVal = (k: string, v: boolean) => setD((p) => ({ ...p, ck: { ...p.ck, [k]: v } }));
  const setTxVal = (k: string, v: string) => setD((p) => ({ ...p, tx: { ...p.tx, [k]: v } }));

  if (mode === 'wizard') {
    return (
      <BillingWizard
        ck={d.ck}
        tx={d.tx}
        setCk={setCkVal}
        setTx={setTxVal}
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

  const tx = (k: string, cls = '') => (
    <input
      {...noAuto}
      className={`t u ${cls}`}
      value={d.tx[k] ?? ''}
      onChange={(e) => setD((p) => ({ ...p, tx: { ...p.tx, [k]: e.target.value } }))}
    />
  );

  const row = ([code, desc]: Code) => (
    <label className="bs-row" key={code}>
      <span className="bs-codecell">
        {ck(code)}
        <span className="bs-code">{code}</span>
      </span>
      <span className="bs-desc">{desc}</span>
    </label>
  );

  return (
    <>
      <div className="awiz-switch screen-only">
        <button type="button" className="chip" onClick={() => setMode('wizard')}>💲 Guided billing wizard</button>
        <span className="awiz-switch-hint">Case info, find-a-code, modifiers, and blocks. The full form stays fillable.</span>
      </div>
    <div className="page bs-page">
      <div className="bs-head">
        <div className="b bs-title">Deseret Peak Anesthesia Billing Information</div>
        <div className="bs-ptlabel">Pt Label</div>
      </div>

      <div className="bs-fields">
        <div className="bs-fline">
          <span className="b">Date:</span>
          {tx('dateM', 'xshort')}<span>/</span>{tx('dateD', 'xshort')}<span>/</span>{tx('dateY', 'xshort')}
        </div>
        <div className="bs-fline"><span className="b">Procedure:</span>{tx('procedure', 'grow')}</div>
        <div className="bs-fline">
          <span className="b">Surgeon</span>{tx('surgeon', 'wide')}
          <span className="b">Dx:</span>{tx('dx', 'grow')}
        </div>
        <div className="bs-fline">
          <span className="b">CRNA</span>
          {d.tx.sigImg ? <img className="sig-inline" src={d.tx.sigImg} alt="signature" /> : tx('crna', 'wide')}
          {d.tx.sigDate && <span className="bs-sigdt">{d.tx.sigDate} {d.tx.sigTime}</span>}
          {signer.signature && (
            <button
              type="button"
              className="chip bs-signbtn screen-only"
              onClick={() => {
                const { date, time } = nowStamp();
                setD((p) => ({ ...p, tx: { ...p.tx, sigImg: p.tx.sigImg ? '' : signer.signature, sigDate: p.tx.sigImg ? '' : date, sigTime: p.tx.sigImg ? '' : time } }));
              }}
            >
              {d.tx.sigImg ? '✕' : `✍ Sign ${signer.initials}`}
            </button>
          )}
          <span className="b">Start Time</span>{tx('startTime', 'med')}
          <span className="b">End Time</span>{tx('endTime', 'med')}
        </div>
      </div>

      <div className="bs-tablehead">
        <span className="b">CPT CODES</span>
        <span className="b">Mark Codes Below for ALL criteria</span>
        <span className="b">*** ADD CODE IF NOT ON FORM HERE</span>
        {tx('addCode', 'med')}
      </div>

      <div className="bs-table">
        <div className="bs-col">{LEFT.map(row)}</div>
        <div className="bs-col">
          {RIGHT_TOP.map(row)}
          <div className="bs-mods">
            <div className="bs-modline">
              <label className="ck">{ck('ageLt1')}<span>Age &lt;1</span></label>
              <label className="ck">{ck('ageGt70')}<span>Age &gt;70</span></label>
            </div>
            <div className="bs-modline">
              <label className="ck">{ck('asa3')}<span>ASA 3</span></label>
              <span>reminder ** BMI &gt; 40 **</span>
            </div>
            <div className="bs-modline">
              <label className="ck">{ck('asa4')}<span>ASA 4</span></label>
              <label className="ck">{ck('prone')}<span>Prone</span></label>
            </div>
            <div className="bs-modline">
              <label className="ck">{ck('turned45')}<span>Pt turned 45 degree or &gt; from anesthesia</span></label>
            </div>
          </div>
          {RIGHT_BOTTOM.map(row)}
        </div>
      </div>
    </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { datePad, noAuto, numPad } from './inputProps';
import { ANES_KEY, BILLING_KEY, PACU_KEY, readSheet, writeSheetCk, writeSheetTx } from './drafts';
import { setCaseField, useCaseData } from './caseData';
import { nowStamp, useSigner } from './signer';
import SignaturePad from './SignaturePad';
import LearnedInput from './LearnedInput';
import type { Bucket } from './learned';
import type { PreopEval } from './types';

// Last look before the packet prints: every box that ought to carry something
// and does not, listed in one place with the answer typed in right here. A box
// that genuinely does not apply gets N/A — the point is that nothing on the
// printed forms is left ambiguous, not that everything has a number in it.

export type PacketTab = 'fields' | 'anes' | 'pacu' | 'billing';

type Kind = 'text' | 'num' | 'date' | 'choice' | 'sig' | 'goto';

interface Gap {
  id: string;
  label: string;
  sheet: string;
  tab: PacketTab;
  kind: Kind;
  options?: string[];
  value: string;
  set?: (v: string) => void;
  na?: () => void; // how "N/A" is recorded, when it is not just the text N/A
  note?: string;
}

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  onGo: (tab: PacketTab) => void;
  onPrint: () => void;
  onClose: () => void;
  /** Tells the mounted record / PACU / billing sheets to re-read their drafts. */
  onDraftsChanged: () => void;
  /** Endo day: the record stays out of the packet, so its questions are
   *  skipped — except the facts billing still needs, asked under Billing. */
  endo?: boolean;
}

const filled = (s: string | undefined) => !!(s ?? '').trim();

// Rows whose answers are worth remembering for the next case.
const LEARNS: Record<string, Bucket> = {
  'case.surgeon': 'surgeon',
  'case.procedure': 'procedure',
  'case.diagnosis': 'diagnosis',
  proposedProcedure: 'procedure',
  surgicalDx: 'diagnosis',
};

export default function PacketReview({ d, set, onGo, onPrint, onClose, onDraftsChanged, endo = false }: Props) {
  const caseData = useCaseData();
  const signer = useSigner();
  // Bumped after every write so the list recomputes from fresh drafts.
  const [tick, setTick] = useState(0);
  // Which signature line the drawing pad is open for, if any.
  const [drawFor, setDrawFor] = useState<string | null>(null);
  const anes = readSheet(ANES_KEY);
  const pacu = readSheet(PACU_KEY);
  const billing = readSheet(BILLING_KEY);
  void tick;

  const touched = () => {
    setTick((t) => t + 1);
    onDraftsChanged();
  };

  // The PACU vitals typed into the record's Recovery box are the same numbers
  // the Post-Anesthesia Note asks for, so the check was asking for them twice.
  // A blank note field takes the record's value here; one filled on the note
  // itself is left alone.
  useEffect(() => {
    const flow = [
      ['recBp', 'panBp'],
      ['recP', 'panP'],
      ['recR', 'panR'],
      ['recO2', 'panO2'],
    ] as const;
    const rec = readSheet(ANES_KEY);
    for (const [from, to] of flow) {
      const v = (rec.tx[from] ?? '').trim();
      if (v && !String(d[to] ?? '').trim()) set(to, v);
    }
    // Mount-only: the copy happens when the check opens, never underneath it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sheetTx = (key: string) => (field: string) => (v: string) => {
    writeSheetTx(key, field, v);
    touched();
  };
  const anesTx = sheetTx(ANES_KEY);

  // Every question this check knows how to ask, each carrying whether it is
  // answered yet. Dropping the answered ones here is what made a box vanish
  // from under the finger typing in it — see `asked` below.
  const all: Array<Gap & { ok: boolean }> = [];
  const need = (g: Gap, ok: boolean) => {
    all.push({ ...g, ok });
  };
  const pre = (id: keyof PreopEval, label: string, kind: Kind = 'text', options?: string[]) =>
    need(
      {
        id: String(id),
        label,
        sheet: 'Pre-Op',
        tab: 'fields',
        kind,
        options,
        value: String(d[id] ?? ''),
        set: (v) => set(id, v as PreopEval[typeof id]),
      },
      filled(String(d[id] ?? '')),
    );

  // ---- Pre-Op evaluation ----
  pre('age', 'Age', 'num');
  pre('sex', 'Sex', 'choice', ['M', 'F']);
  pre('height', 'Height', 'num');
  pre('weight', 'Weight', 'num');
  pre('proposedProcedure', 'Proposed procedure');
  pre('surgicalDx', 'Surgical diagnosis', 'text');
  // BP is digits and a slash — the ten-key has both, so it answers on the pad
  // like every other number instead of summoning the OS keyboard.
  pre('bp', 'Pre-op BP', 'num');
  pre('p', 'Pre-op pulse', 'num');
  pre('r', 'Pre-op respirations', 'num');
  pre('t', 'Pre-op temperature', 'num');
  pre('mallampati', 'Mallampati class', 'choice', ['I', 'II', 'III', 'IV']);
  pre('npo', 'NPO since', 'text');
  pre('tmd', 'TMD', 'choice', ['2', '3', '4']);
  pre('rom', 'ROM', 'choice', ['Full', 'Limited']);
  pre('plannedAnesthesia', 'Planned anesthesia');
  pre('physicalStatus', 'Physical status (ASA)', 'choice', ['1', '2', '3', '4', '5']);

  // A "None" box on the form answers these as surely as any text does.
  need(
    {
      id: 'allergies',
      label: 'Allergies',
      sheet: 'Pre-Op',
      tab: 'fields',
      kind: 'text',
      value: d.allergies,
      set: (v) => set('allergies', v),
      na: () => set('allergiesNone', true),
      note: 'N/A ticks the None box',
    },
    d.allergiesNone || filled(d.allergies) || d.allergyList.length > 0,
  );
  need(
    {
      id: 'currentMedications',
      label: 'Current medications',
      sheet: 'Pre-Op',
      tab: 'fields',
      kind: 'text',
      value: d.currentMedications,
      set: (v) => set('currentMedications', v),
      na: () => set('currentMedicationsNone', true),
      note: 'N/A ticks the None box',
    },
    d.currentMedicationsNone || filled(d.currentMedications) || d.meds.length > 0,
  );
  need(
    {
      id: 'previousAnesthesia',
      label: 'Previous anesthesia / operations',
      sheet: 'Pre-Op',
      tab: 'fields',
      kind: 'text',
      value: d.previousAnesthesia,
      set: (v) => set('previousAnesthesia', v),
      na: () => set('previousAnesthesiaNone', true),
      note: 'N/A ticks the None box',
    },
    d.previousAnesthesiaNone || filled(d.previousAnesthesia) || d.prevHxList.length > 0,
  );
  need(
    {
      id: 'familyHistory',
      label: 'Family history of anesthesia complications',
      sheet: 'Pre-Op',
      tab: 'fields',
      kind: 'text',
      value: d.familyHistory,
      set: (v) => set('familyHistory', v),
      na: () => set('familyHistoryNone', true),
      note: 'N/A ticks the None box',
    },
    d.familyHistoryNone || filled(d.familyHistory),
  );

  // Studies: the form's own None box covers the lot, or answer them one by one
  // — an EKG that was not done says so on the printed sheet.
  const study = (id: 'dxEkg' | 'dxCxr' | 'dxPulm', label: string) =>
    need(
      {
        id,
        label,
        sheet: 'Pre-Op',
        tab: 'fields',
        kind: 'text',
        value: d[id],
        set: (v) => set(id, v),
      },
      d.dxNone || filled(d[id]),
    );
  study('dxEkg', 'EKG');
  study('dxCxr', 'Chest X-ray');
  study('dxPulm', 'Pulmonary studies');
  const lab = (id: 'labHgb' | 'labElectrolytes' | 'labUrinalysis', label: string) =>
    need({ id, label, sheet: 'Pre-Op', tab: 'fields', kind: 'text', value: d[id], set: (v) => set(id, v) }, filled(d[id]));
  need(
    {
      id: 'hcg',
      label: 'Pregnancy test (hCG)',
      sheet: 'Pre-Op',
      tab: 'fields',
      kind: 'choice',
      options: ['Positive', 'Negative', 'Not needed'],
      value: ({ pos: 'Positive', neg: 'Negative', na: 'Not needed' } as Record<string, string>)[d.hcg] ?? '',
      set: (v) => set('hcg', ({ Positive: 'pos', Negative: 'neg', 'Not needed': 'na' } as Record<string, PreopEval['hcg']>)[v] ?? ''),
      na: () => set('hcg', 'na'),
    },
    !!d.hcg,
  );
  lab('labHgb', 'Hgb / Hct / CBC');
  lab('labElectrolytes', 'Electrolytes');
  lab('labUrinalysis', 'Urinalysis');

  need(
    {
      id: 'evalSig',
      label: 'Pre-anesthesia evaluation signature',
      sheet: 'Pre-Op',
      tab: 'fields',
      kind: 'sig',
      value: d.evalSig ? 'signed' : '',
      set: (sig) => {
        const { date, time } = nowStamp();
        set('evalSig', sig);
        set('evalDateTime', `${date} ${time}`);
        set('evalSigName', signer.name || signer.initials);
      },
    },
    !!d.evalSig,
  );

  // ---- Anesthesia record ----
  // On an endo day the record stays out of the packet (the endo nurse charts
  // the vitals on her own document), so the record-only questions are not
  // asked — but the facts billing still needs (date, times, surgeon,
  // procedure, diagnosis) are, filed under Billing.
  const recSheet = endo ? 'Billing' : 'Record';
  const recTab: PacketTab = endo ? 'billing' : 'anes';
  const rec = (id: string, label: string, kind: Kind = 'text', options?: string[]) =>
    need(
      { id: `anes.${id}`, label, sheet: recSheet, tab: recTab, kind, options, value: anes.tx[id] ?? '', set: anesTx(id) },
      filled(anes.tx[id]),
    );
  rec('date', 'Case date', 'date');
  if (!endo) rec('orNum', 'OR', 'choice', ['1', '2', '3', '4', 'Endo']);
  rec('anesStart', 'Anesthesia start', 'num');
  rec('anesStop', 'Anesthesia stop', 'num');
  if (!endo) {
    rec('surgStart', 'Surgery start', 'num');
    rec('surgStop', 'Surgery stop', 'num');
    // Most cases never had a tourniquet up — N/A is the one-tap answer; a case
    // that did gets its time onto the printed sheet instead of a blank TT box.
    rec('tt', 'Tourniquet time (TT)', 'num');

    // The reassessment box at the top of the record's Remarks — small enough to
    // walk right past on the form, so the check asks for it by name.
    need(
      {
        id: 'anes.preInduction',
        label: 'Pre-induction anesthetic reassessment',
        sheet: 'Record',
        tab: 'anes',
        kind: 'choice',
        options: ['✓ Done'],
        value: anes.ck.preInduction ? '✓ Done' : '',
        set: (v) => {
          if (v !== '✓ Done') return; // N/A has no box to tick
          writeSheetCk(ANES_KEY, 'preInduction', true);
          touched();
        },
        note: 'Checks the box at the top of the Remarks box',
      },
      !!anes.ck.preInduction,
    );

    // The Regional Anesthesia box is never left ambiguous: a block fills it,
    // no block strikes it through, same as the hand's one line on paper.
    const blockMarked = ['spinal', 'epidural', 'bier', 'axillary', 'local', 'condOther'].some((k) => anes.ck[k]);
    need(
      {
        id: 'anes.condNA',
        label: 'Regional anesthesia box',
        sheet: 'Record',
        tab: 'anes',
        kind: 'choice',
        options: ['N/A — no block'],
        value: anes.ck.condNA ? 'N/A — no block' : blockMarked ? 'marked' : '',
        set: (v) => {
          if (v !== 'N/A — no block') return;
          writeSheetCk(ANES_KEY, 'condNA', true);
          touched();
        },
        note: 'Prints a line through the box',
      },
      !!anes.ck.condNA || blockMarked,
    );

    const asaMarked = ['asa1', 'asa2', 'asa3', 'asa4', 'asa5'].find((k) => anes.ck[k]);
    need(
      {
        id: 'anes.asa',
        label: 'ASA class',
        sheet: 'Record',
        tab: 'anes',
        kind: 'choice',
        options: ['1', '2', '3', '4', '5'],
        value: asaMarked ? asaMarked.slice(-1) : '',
        set: (v) => {
          ['asa1', 'asa2', 'asa3', 'asa4', 'asa5'].forEach((k) => writeSheetCk(ANES_KEY, k, k === `asa${v}`));
          touched();
        },
      },
      !!asaMarked,
    );
  }

  const caseField = (id: 'surgeon' | 'procedure' | 'diagnosis', label: string) =>
    need(
      {
        id: `case.${id}`,
        label,
        sheet: recSheet,
        tab: recTab,
        kind: 'text',
        value: caseData[id],
        set: (v) => setCaseField(id, v),
      },
      filled(caseData[id]),
    );
  caseField('surgeon', 'Surgeon');
  caseField('procedure', 'Procedure');
  caseField('diagnosis', 'Diagnosis');

  if (!endo) {
    need(
      {
        id: 'anes.sig',
        label: 'Anesthetist signature',
        sheet: 'Record',
        tab: 'anes',
        kind: 'sig',
        value: anes.tx.sigImg ? 'signed' : '',
        set: (sig) => {
          const { date, time } = nowStamp();
          writeSheetTx(ANES_KEY, 'sigImg', sig);
          writeSheetTx(ANES_KEY, 'sigDate', date);
          writeSheetTx(ANES_KEY, 'sigTime', time);
          writeSheetTx(ANES_KEY, 'sigName', signer.name || signer.initials);
          touched();
        },
      },
      filled(anes.tx.sigImg),
    );
  }

  // ---- Post-anesthesia note (prints on the pre-op sheet, filled in PACU) ----
  const pan = (id: keyof PreopEval, label: string, kind: Kind = 'num', options?: string[]) =>
    need(
      {
        id: String(id),
        label,
        sheet: 'PACU',
        tab: 'pacu',
        kind,
        options,
        value: String(d[id] ?? ''),
        set: (v) => set(id, v as PreopEval[typeof id]),
      },
      filled(String(d[id] ?? '')),
    );
  pan('panBp', 'Post-anesthesia BP');
  pan('panP', 'Post-anesthesia pulse');
  pan('panR', 'Post-anesthesia respirations');
  pan('panO2', 'Post-anesthesia O₂ sat');
  pan('panMental', 'Mental status', 'choice', ['Alert', 'Drowsy', 'Somnolent', 'Unresponsive']);
  pan('panAirway', 'Airway patency', 'choice', ['Patent', 'Oral airway', 'Nasal airway', 'Intubated']);
  pan('panNV', 'Nausea / vomiting', 'choice', ['None', 'Nausea', 'Vomiting']);
  pan('panHydration', 'Hydration', 'text');
  need(
    {
      id: 'panSig',
      label: 'Post-anesthesia note signature',
      sheet: 'PACU',
      tab: 'pacu',
      kind: 'sig',
      value: d.panSig ? 'signed' : '',
      set: (sig) => {
        const { date, time } = nowStamp();
        set('panSig', sig);
        set('panDateTime', `${date} ${time}`);
        set('panSigName', signer.name || signer.initials);
      },
    },
    !!d.panSig,
  );

  need(
    {
      id: 'pacu.sig',
      label: 'PACU orders signature',
      sheet: 'PACU',
      tab: 'pacu',
      kind: 'sig',
      value: pacu.tx.sigImg ? 'signed' : '',
      set: (sig) => {
        const { date, time } = nowStamp();
        writeSheetTx(PACU_KEY, 'sigImg', sig);
        writeSheetTx(PACU_KEY, 'date', date);
        writeSheetTx(PACU_KEY, 'time', time);
        writeSheetTx(PACU_KEY, 'sigName', signer.name || signer.initials);
        touched();
      },
    },
    filled(pacu.tx.sigImg),
  );

  // ---- Billing ----
  // Its header fills itself from the case; what no one else can supply is the
  // code being billed.
  need(
    {
      id: 'billing.code',
      label: 'A CPT code marked',
      sheet: 'Billing',
      tab: 'billing',
      kind: 'goto',
      value: '',
      note: 'Pick the anesthesia code on the billing sheet',
    },
    Object.values(billing.ck).some(Boolean) || filled(billing.tx.addCode),
  );
  need(
    {
      id: 'billing.crna',
      label: 'CRNA',
      sheet: 'Billing',
      tab: 'billing',
      kind: 'text',
      value: billing.tx.crna ?? '',
      set: sheetTx(BILLING_KEY)('crna'),
    },
    filled(billing.tx.crna) || filled(billing.tx.sigImg),
  );

  // The list is fixed when the check opens: a question stays on it while it is
  // being answered, ticking over to answered in place. Recomputing it on every
  // keystroke removed the row the moment it held one character, which took the
  // box — and the keyboard — with it.
  const [asked] = useState(() => new Set(all.filter((g) => !g.ok).map((g) => g.id)));
  const gaps = all.filter((g) => asked.has(g.id));
  const remaining = gaps.filter((g) => !g.ok).length;
  const sheets = ['Pre-Op', 'Record', 'PACU', 'Billing'].filter((s) => gaps.some((g) => g.sheet === s));

  const answerNA = (g: Gap) => {
    if (g.na) g.na();
    else g.set?.('N/A');
  };

  // Signing happens here. A provider with a saved signature stamps it in one
  // tap; anyone else draws it on the spot, rather than being sent off to hunt
  // for a signature line on the form itself.
  const signNow = (g: Gap) => {
    if (signer.signature) g.set?.(signer.signature);
    else setDrawFor(g.id);
  };

  const control = (g: Gap) => {
    if (g.kind === 'sig') {
      return (
        <button type="button" className="chip on" onClick={() => signNow(g)}>
          {signer.signature ? `✍ Sign as ${signer.initials}` : '✍ Sign here'}
        </button>
      );
    }
    if (g.kind === 'goto') {
      return (
        <button type="button" className="chip on" onClick={() => onGo(g.tab)}>
          Open {g.sheet} →
        </button>
      );
    }
    if (g.kind === 'choice') {
      return (
        <div className="chips wrap">
          {(g.options ?? []).map((o) => (
            <button
              key={o}
              type="button"
              className={`chip${g.value === o ? ' on' : ''}`}
              onClick={() => g.set?.(o)}
            >
              {o}
            </button>
          ))}
        </div>
      );
    }
    // The boxes that name the case remember what has been typed in them.
    const bucket = LEARNS[g.id];
    if (bucket) {
      return (
        <LearnedInput
          bucket={bucket}
          className="pr-input"
          value={g.value}
          placeholder="answer here"
          onChange={(v) => g.set?.(v)}
        />
      );
    }
    const props = g.kind === 'num' ? numPad : g.kind === 'date' ? datePad : noAuto;
    return (
      <input
        {...props}
        className="pr-input"
        value={g.value}
        placeholder="answer here"
        onChange={(e) => g.set?.(e.target.value)}
      />
    );
  };

  const drawing = drawFor ? gaps.find((g) => g.id === drawFor) : null;

  return (
    <section className="pr screen-only">
      {drawing && (
        <SignaturePad
          onSave={(sig) => {
            drawing.set?.(sig);
            setDrawFor(null);
          }}
          onCancel={() => setDrawFor(null)}
        />
      )}
      <div className="pr-head">
        <h2>{remaining ? `${remaining} blank${remaining === 1 ? '' : 's'} before printing` : 'Nothing left blank'}</h2>
        <button type="button" className="chip" onClick={onClose}>✕ Close</button>
      </div>

      {gaps.length === 0 ? (
        <p className="pr-hint">Every box the packet needs has an answer in it. Good to print.</p>
      ) : (
        <p className="pr-hint">
          Answer them here &mdash; it writes straight onto the forms. Anything that genuinely does not
          apply takes <b>N/A</b>, so the printed sheet says so rather than leaving a reader guessing.
        </p>
      )}

      {sheets.map((s) => (
        <div className="pr-sheet" key={s}>
          <div className="pr-sheethead">
            <span className="pr-sheetname">{s}</span>
            <button type="button" className="chip" onClick={() => onGo(gaps.find((g) => g.sheet === s)!.tab)}>
              Open the {s} tab →
            </button>
          </div>
          {gaps
            .filter((g) => g.sheet === s)
            .map((g) => (
              <div className={`pr-row${g.ok ? ' answered' : ''}`} key={g.id}>
                <span className="pr-label">
                  {g.ok && <span className="pr-tick" aria-label="answered">✓</span>}
                  {g.label}
                  {g.note && !g.ok && <span className="pr-note">{g.note}</span>}
                </span>
                <span className="pr-ctl">{control(g)}</span>
                {g.kind !== 'goto' && g.kind !== 'sig' && (
                  <button type="button" className="chip pr-na" onClick={() => answerNA(g)}>N/A</button>
                )}
              </div>
            ))}
        </div>
      ))}

      <div className="pr-foot">
        <button type="button" className="pk-big" onClick={onPrint}>
          {remaining ? `🖨 Print anyway (${remaining} blank)` : `🖨 Print all ${endo ? 3 : 4} pages`}
        </button>
        <button type="button" className="chip" onClick={onClose}>Back to the packet</button>
      </div>
    </section>
  );
}

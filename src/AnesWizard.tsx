import { useEffect, useState, type ReactNode } from 'react';
import { composeNarrative } from './narrative';
import ScanVial, { type VialScan } from './ScanVial';
import type { VitalsData, Series } from './VitalsGraph';
import { noAuto, numPad, tempPad, timePad } from './inputProps';

// "0730"/"7:30"/"730" → minutes since midnight, or null.
function parseHHMM(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
function toHHMM(mins: number): string {
  const t = ((mins % 1440) + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + String(t % 60).padStart(2, '0');
}

// Guided walk-through of the Anesthesia Record's dense, easy-to-miss "hard
// points" — start of case, airway & positioning, regional/blocks, end of
// case. The live charting grid (drug values, BP/HR marks) stays tap-and-drag
// on the full form; this wizard just fills the checkbox/text fields. It reads
// and writes the same draft, so anything set here shows on the printed record.

export interface WizardApi {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
  cells: Record<string, string>;
  setCk: (k: string, v: boolean) => void;
  setTx: (k: string, v: string) => void;
  setCell: (k: string, v: string) => void;
  /** The vitals series, so the first BP and HR are a wizard step too. */
  vitals: VitalsData;
  setVitals: (next: VitalsData) => void;
  endCol: number;
  onDone: () => void;
  /** Open at the first step of this phase — 'End of case' is the landing pass. */
  startPhase?: string;
}

interface Step {
  phase: string;
  title: string;
  hint?: string;
  render: () => ReactNode;
}

// Short labels for the section jump-nav so all sections fit in the strip.
const NAV_SHORT: Record<string, string> = {
  'Machine & technique': 'Machine',
  'IV access': 'IV',
  'ASA physical status': 'ASA',
  'Regional block': 'Regional',
  'Induction drugs': 'Induction',
  'Wheels down': 'Landing',
  Positioning: 'Position',
  'Emergence & reversal': 'Emergence',
  'Fluid totals': 'Fluids',
  'Recovery & handoff': 'Recovery',
};

// The monitors that go on for every case — the one-tap set on the wizard's
// Monitors step. Edit this list when the department's "usuals" change.
const STANDARD_MONITORS = [
  'bpAuto',
  'pulseOx',
  'capnography',
  'ecg',
  'nerveStim',
  'o2Analyzer',
  'temp',
  'tempSk', // temp: skin
  'bairHugger',
  'hme',
];

// Every box that holds a clock time — they all get the Now key.
const TIME_FIELDS = ['anesStart', 'anesStop', 'surgStart', 'surgStop', 'ettTime', 'recTime', 'condTime', 'remarkTime', 'transferCare', 'tt'];

export default function AnesWizard(api: WizardApi) {
  const [step, setStep] = useState(0);
  const [scanVial, setScanVial] = useState(false);

  // Landing the case starts the wizard at the end-of-case phase.
  const { startPhase } = api;
  const [jumped, setJumped] = useState(false);

  // Airway time auto-fills 7 minutes after the anesthesia start time (once, if
  // it hasn't been set yet — a manual entry is never overwritten).
  const { setTx } = api;
  const anesStart = api.tx.anesStart ?? '';
  const ettTime = api.tx.ettTime ?? '';
  useEffect(() => {
    if (ettTime) return;
    const base = parseHHMM(anesStart);
    if (base == null) return;
    setTx('ettTime', toHHMM(base + 7));
  }, [anesStart, ettTime, setTx]);

  const chip = (active: boolean, onClick: () => void, label: string, key?: string) => (
    <button key={key ?? label} type="button" className={`chip${active ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
  const ckChip = (k: string, label: string) => chip(!!api.ck[k], () => api.setCk(k, !api.ck[k]), label, k);
  // One of a pair: ticking this one unticks its opposite.
  const xckChip = (k: string, other: string, label: string) =>
    chip(!!api.ck[k], () => {
      const next = !api.ck[k];
      api.setCk(k, next);
      if (next) api.setCk(other, false);
    }, label, k);
  // The PACU vitals chain on the pad: finish the BP and it hops to O₂ sat,
  // then pulse, then resps — one pad, no keyboard, landing-speed.
  const REC_CHAIN: Record<string, string> = { recO2: 'recP', recP: 'recR', recR: '' };
  // Handoff BP as two hopping boxes: type the systolic, it jumps to the
  // diastolic, then on into the O₂ → pulse → resps chain — one tap, then just
  // digits. Stored as the record's single "sys/dia" value.
  const bpBoxes = () => {
    const [sys = '', dia = ''] = (api.tx.recBp ?? '').split('/');
    const write = (s: string, dv: string) => api.setTx('recBp', dv ? `${s}/${dv}` : s);
    return (
      <>
        <label className="ifield" key="recBpSys">
          <span>BP sys</span>
          <input
            {...numPad}
            data-vseq="recBpSys"
            data-vnext="recBpDia"
            value={sys}
            placeholder="120"
            onChange={(e) => write(e.target.value.replace(/[^0-9]/g, ''), dia)}
          />
        </label>
        <label className="ifield" key="recBpDia">
          <span>dia</span>
          <input
            {...numPad}
            data-vseq="recBpDia"
            data-vnext="recO2"
            value={dia}
            placeholder="80"
            onChange={(e) => write(sys, e.target.value.replace(/[^0-9]/g, ''))}
          />
        </label>
      </>
    );
  };
  const field = (label: string, k: string, ph = '') => (
    <label className="ifield" key={k}>
      <span>{label}</span>
      <input
        {...(['recT'].includes(k) ? tempPad : TIME_FIELDS.includes(k) ? timePad : ['tubeLength', 'attempts', 'crystalloid', 'fluidEbl', 'fluidUrine', 'fluidBlood', 'recO2', 'recP', 'recR', 'recRoom'].includes(k) ? numPad : noAuto)}
        {...(k in REC_CHAIN ? { 'data-vseq': k, 'data-vnext': REC_CHAIN[k] } : {})}
        value={api.tx[k] ?? ''}
        placeholder={ph}
        onChange={(e) => api.setTx(k, e.target.value)}
      />
    </label>
  );
  // First reading of a vitals series → column 0, same as the fields on the
  // chart. One series per keystroke, so no write can clobber another.
  const vitalField = (label: string, series: Series) => (
    <label className="ifield" key={series}>
      <span>{label}</span>
      <input
        {...numPad}
        data-vseq={series}
        data-vnext={series === 'sys' ? 'dia' : series === 'dia' ? 'hr' : ''}
        value={api.vitals[series][0] ?? ''}
        onChange={(e) => {
          const raw = e.target.value.trim();
          const next = { ...api.vitals[series] };
          if (raw === '' || Number.isNaN(Number(raw))) delete next[0];
          else next[0] = Math.round(Number(raw));
          api.setVitals({ ...api.vitals, [series]: next });
        }}
      />
    </label>
  );

  const group = (title: string, children: ReactNode) => (
    <div className="igroup"><span>{title}</span><div className="chips wrap">{children}</div></div>
  );
  // Single-select chips that write a text value (with a free-text fallback).
  const pick = (title: string, k: string, opts: string[], free = false, ph = '') => (
    <div className="igroup" key={k}>
      <span>{title}</span>
      <div className="chips wrap">
        {opts.map((o) => chip(api.tx[k] === o, () => api.setTx(k, api.tx[k] === o ? '' : o), o, k + o))}
        {free && (
          <input {...numPad} className="awiz-doseinput" placeholder={ph || 'other'} value={opts.includes(api.tx[k]) ? '' : (api.tx[k] ?? '')} onChange={(e) => api.setTx(k, e.target.value)} />
        )}
      </div>
    </div>
  );
  // A drug with common-dose quick-pick chips that fill the grid cell. Some
  // rows print as a circled pair (VEC/ROC, SUFENTA/SUBLIMAZE) — giving the
  // drug also circles its name on the record via `picks`.
  const drugDoses = (label: string, cellKey: string, unit: string, doses: number[], picks?: { on: string; off: string[] }) => {
    const gave = (v: string) => {
      if (picks && v.trim() !== '') {
        api.setCk(picks.on, true);
        picks.off.forEach((o) => api.setCk(o, false));
      }
    };
    return (
      <div className="igroup" key={cellKey}>
        <span>{label} <span className="awiz-unit">{unit}</span></span>
        <div className="chips wrap">
          {doses.map((dv) => chip(api.cells[cellKey] === String(dv), () => {
            const next = api.cells[cellKey] === String(dv) ? '' : String(dv);
            api.setCell(cellKey, next);
            gave(next);
          }, String(dv), cellKey + dv))}
          <input {...numPad} className="awiz-doseinput" placeholder="other" value={doses.map(String).includes(api.cells[cellKey]) ? '' : (api.cells[cellKey] ?? '')} onChange={(e) => { api.setCell(cellKey, e.target.value); gave(e.target.value); }} />
        </div>
      </div>
    );
  };

  // Regional Anesthesia box entries: each printed line is a checkbox and a
  // blank, and the check rides the value — writing a dose ticks its drug,
  // clearing it unticks.
  const condSet = (ckKey: string, txKey: string) => (v: string) => {
    api.setTx(txKey, v);
    api.setCk(ckKey, v.trim() !== '');
  };
  const condDrug = (label: string, ckKey: string, txKey: string, unit: string) => (
    <label className="ifield" key={txKey}>
      <span>{label} <span className="awiz-unit">{unit}</span></span>
      <input {...numPad} value={api.tx[txKey] ?? ''} placeholder="dose" onChange={(e) => condSet(ckKey, txKey)(e.target.value)} />
    </label>
  );
  const condText = (label: string, ckKey: string, txKey: string) => (
    <label className="ifield" key={txKey}>
      <span>{label}</span>
      <input {...noAuto} value={api.tx[txKey] ?? ''} onChange={(e) => condSet(ckKey, txKey)(e.target.value)} />
    </label>
  );
  const condPick = (title: string, ckKey: string, txKey: string, opts: string[], free = true) => (
    <div className="igroup" key={txKey}>
      <span>{title}</span>
      <div className="chips wrap">
        {opts.map((o) => chip(api.tx[txKey] === o, () => condSet(ckKey, txKey)(api.tx[txKey] === o ? '' : o), o, txKey + o))}
        {free && (
          <input {...numPad} className="awiz-doseinput" placeholder="other" value={opts.includes(api.tx[txKey]) ? '' : (api.tx[txKey] ?? '')} onChange={(e) => condSet(ckKey, txKey)(e.target.value)} />
        )}
      </div>
    </div>
  );
  const condTimeField = () => (
    <label className="ifield" key="condTime">
      <span>Block time</span>
      <input {...timePad} value={api.tx.condTime ?? ''} placeholder="HHMM" onChange={(e) => condSet('condTimeCk', 'condTime')(e.target.value)} />
    </label>
  );

  // A continuously-running setting: pick a starting value and carry-forward
  // fills it across the chart until it is changed.
  const settingRow = (
    label: string,
    cellKey: string,
    unit: string,
    opts: Array<string | number>,
    slider?: { min: number; max: number; inc: number; start: number },
  ) => (
    <div className="igroup" key={cellKey}>
      <span>{label} <span className="awiz-unit">{unit}</span></span>
      <div className="chips wrap">
        {opts.map((o) =>
          chip(api.cells[cellKey] === String(o), () => api.setCell(cellKey, api.cells[cellKey] === String(o) ? '' : String(o)), String(o), cellKey + o),
        )}
        {/* Tapping the box opens the same slider the chart cells use, so a
            value between the chips can be dialled in rather than typed. */}
        <input
          {...numPad}
          {...(slider
            ? {
                'data-step-min': slider.min,
                'data-step-max': slider.max,
                'data-step-inc': slider.inc,
                'data-step-label': label,
                'data-step-unit': unit === 'fraction' ? '' : unit,
                'data-step-start': slider.start,
              }
            : {})}
          className="awiz-doseinput"
          placeholder={slider ? 'slide…' : 'other'}
          value={opts.map(String).includes(api.cells[cellKey]) ? '' : (api.cells[cellKey] ?? '')}
          onChange={(e) => api.setCell(cellKey, e.target.value)}
        />
      </div>
    </div>
  );

  const steps: Step[] = [
    // ---------- Phase 1: Start of case ----------
    {
      phase: 'Start of case',
      title: 'Machine & technique',
      hint: 'Pre-case checks and the anesthetic technique.',
      render: () => (
        <>
          {group('Checks', <>{ckChip('gasCheck', 'Gas Machine Check')}{ckChip('equipCheck', 'Equipment Check')}{ckChip('disconnect', 'Disconnect')}</>)}
          {group('Technique', <>{ckChip('general', 'General')}{ckChip('mac', 'MAC')}{ckChip('regional', 'Regional')}</>)}
        </>
      ),
    },
    {
      phase: 'Start of case',
      title: 'Times',
      hint: 'All four in one place — the stops get filled at the end of the case. The anesthesia start anchors the charting grid.',
      render: () => (
        <>
          <div className="irow">
            {field('Anesthesia start', 'anesStart', 'HHMM')}
            {field('Surgery start', 'surgStart', 'HHMM')}
          </div>
          <div className="irow">
            {field('Surgery stop', 'surgStop', 'HHMM')}
            {field('Anesthesia stop', 'anesStop', 'HHMM')}
          </div>
        </>
      ),
    },
    {
      phase: 'Start of case',
      title: 'Monitors',
      hint: 'Everything on the patient.',
      render: () => (
        <>
          {/* The same set goes on nearly every patient — one tap ticks the
              lot. Tapping again (with all of them on) takes them all off. */}
          <div className="chips wrap awiz-stdmon">
            <button
              type="button"
              className={`chip${STANDARD_MONITORS.every((k) => api.ck[k]) ? ' on' : ''}`}
              onClick={() => {
                const allOn = STANDARD_MONITORS.every((k) => api.ck[k]);
                STANDARD_MONITORS.forEach((k) => api.setCk(k, !allOn));
              }}
            >
              ⭐ Standard monitors
            </button>
            <span className="ihint">BP · pulse ox · capnography · ECG · nerve stim · O₂ analyzer · temp (skin) · Bair Hugger · HME</span>
            {/* The one thing the set cannot guess: which arm the cuff is on. */}
            {STANDARD_MONITORS.every((k) => api.ck[k]) && (
              <span className="awiz-bpside">
                <span className="ihint">BP side:</span>
                {chip(!!api.ck.bpL, () => { api.setCk('bpL', !api.ck.bpL); if (!api.ck.bpL) api.setCk('bpR', false); }, 'L', 'bpsideL')}
                {chip(!!api.ck.bpR, () => { api.setCk('bpR', !api.ck.bpR); if (!api.ck.bpR) api.setCk('bpL', false); }, 'R', 'bpsideR')}
              </span>
            )}
          </div>
          {group('BP', <>{ckChip('bpAuto', 'Auto')}{ckChip('bpManual', 'Manual')}{ckChip('bpArm', 'Arm')}{ckChip('bpLeg', 'Leg')}{ckChip('bpL', 'L')}{ckChip('bpR', 'R')}</>)}
          {group('Standard', <>{ckChip('pulseOx', 'Pulse Oximeter')}{ckChip('capnography', 'Capnography')}{ckChip('ecg', 'ECG')}{ckChip('nerveStim', 'Nerve Stimulator')}{ckChip('o2Analyzer', 'O₂ Analyzer')}</>)}
          {group('Temp', <>{ckChip('temp', 'Temp')}{ckChip('tempE', 'E')}{ckChip('tempSk', 'SK')}{ckChip('tempBlad', 'Blad')}{ckChip('tempR', 'R')}</>)}
          {group('Warming / lines', <>{ckChip('warmerIv', 'IV Blood Warmer')}{ckChip('bairHugger', 'Bair Hugger')}{ckChip('hme', 'HME')}{ckChip('artLine', 'Arterial Line')}{ckChip('cvp', 'CVP')}{ckChip('swanGanz', 'Swan-Ganz')}</>)}
        </>
      ),
    },
    {
      phase: 'Start of case',
      title: 'IV access',
      hint: 'Where the IV is and what it is — tap the gauge and site.',
      render: () => (
        <>
          {pick('Gauge', 'ivSize', ['14g', '16g', '18g', '20g', '22g', '24g'])}
          {pick('Site', 'ivArea', ['R hand', 'L hand', 'R forearm', 'L forearm', 'R AC', 'L AC', 'EJ', 'Foot'], true, 'other site')}
        </>
      ),
    },
    {
      phase: 'Start of case',
      title: 'ASA physical status',
      render: () =>
        // One grade only — picking a class un-picks the others. E rides on top.
        group('ASA', <>{['1', '2', '3', '4', '5'].map((n) => chip(api.ck[`asa${n}`], () => {
          const next = !api.ck[`asa${n}`];
          ['1', '2', '3', '4', '5'].forEach((m) => api.setCk(`asa${m}`, m === n ? next : false));
        }, n, `asa${n}`))}{ckChip('asaE', 'E (Emergency)')}</>),
    },
    {
      phase: 'Start of case',
      title: 'Regional block',
      hint: 'The Regional Anesthesia box, top right of the record: what was placed, with what, and where. Skip it for a straight general.',
      render: () => {
        // Picking a technique withdraws the N/A strike; N/A prints the hand's
        // one line through the whole box.
        const tech = (k: string, label: string) =>
          chip(!!api.ck[k], () => {
            const next = !api.ck[k];
            api.setCk(k, next);
            if (next) api.setCk('condNA', false);
          }, label, k);
        return (
        <>
          {group('No block?', chip(!!api.ck.condNA, () => api.setCk('condNA', !api.ck.condNA), '🚫 N/A — no block (a line through the box)'))}
          {group('Technique', (
            <>
              {tech('spinal', 'Spinal')}
              {tech('epidural', 'Epidural')}
              {tech('bier', 'Bier')}
              {tech('axillary', 'Axillary')}
              {tech('local', 'Local')}
              {tech('condOther', 'Other')}
            </>
          ))}
          {condDrug('Duramorph', 'duramorphCk', 'duramorph', 'mg')}
          {condDrug('Fentanyl', 'fentanylCk', 'fentanyl', 'mcg')}
          {condDrug('Sufenta', 'sufentaCk', 'sufenta', 'mcg')}
          {condDrug('Naropin', 'naropinCk', 'naropin', 'mL')}
          {condDrug('Nesacaine', 'nesacaineCk', 'nesacaine', 'mL')}
          {condDrug('Sensorcaine', 'sensorcaineCk', 'sensorcaine', 'mL')}
          {condDrug('Xylocaine', 'xylocaineCk', 'xylocaine', 'mL')}
          {condText('Other drug', 'condOther1Ck', 'condOther1')}
          {condPick('Needle size', 'needleSizeCk', 'needleSize', ['22', '25', '27'])}
          {condPick('# Attempts', 'condAttemptsCk', 'condAttempts', ['1', '2', '3'])}
          {condPick('Site / level', 'siteCk', 'site', ['L2-3', 'L3-4', 'L4-5'], true)}
          {group('On the way in', (
            <>
              {ckChip('paresthesia', 'Paresthesia')}
              {ckChip('cffcsf', 'CFFCSF')}
            </>
          ))}
          {condTimeField()}
          {group('The vial (this case)', (
            <>
              {chip(false, () => setScanVial(true), '📷 Scan the kit — lot & expiration fill themselves')}
              <div className="irow">
                {field('Lot #', 'lotNum')}
                {field('Expiration date', 'expDate')}
                {field('Manufacturer', 'manufacturer')}
              </div>
            </>
          ))}
          {scanVial && (
            <ScanVial
              onClose={() => setScanVial(false)}
              onUse={(scan: VialScan) => {
                if (scan.lot) api.setTx('lotNum', scan.lot);
                if (scan.exp) api.setTx('expDate', scan.exp);
                if (scan.ref && !(api.tx.manufacturer ?? '').trim()) api.setTx('manufacturer', `REF ${scan.ref}`);
              }}
            />
          )}
        </>
        );
      },
    },
    {
      phase: 'Start of case',
      title: 'Induction drugs',
      hint: 'Tap the common dose or type another — these drop into the first (surgery-start) grid column.',
      render: () => (
        <>
          {/* The reassessment box lives at the top of the record's Remarks —
              easy to walk past on the form, so it is asked right here. */}
          {group('Before induction', ckChip('preInduction', 'Pre-induction anesthetic reassessment done'))}
          {drugDoses('Lidocaine', 'oth5:0', 'mg', [40, 50, 100])}
          {drugDoses('Propofol', 'med3:0', 'mg', [100, 150, 200])}
          {drugDoses('Fentanyl', 'med6:0', 'mcg', [50, 100, 150, 250], { on: 'fentMed', off: ['sufMed'] })}
          {drugDoses('Versed', 'med7:0', 'mg', [1, 2])}
          {drugDoses('Rocuronium', 'med5:0', 'mg', [30, 50], { on: 'rocMed', off: ['vecMed'] })}
          {drugDoses('Succinylcholine', 'med4:0', 'mg', [100])}
          {drugDoses('Ancef (cefazolin)', 'oth6:0', 'g', [1, 2, 3])}
        </>
      ),
    },
    // ---------- Phase 2: Airway & positioning ----------
    {
      phase: 'Airway & positioning',
      title: 'Airway',
      hint: 'Endotracheal / airway details.',
      render: () => (
        <>
          {/* "Oral / Nasal / RAE" on its own does not say what is going in —
              they are all tubes, so they are labelled as tubes. */}
          {group('Airway type', <>{ckChip('ettOral', 'ETT oral')}{ckChip('ettNasal', 'ETT nasal')}{ckChip('ettRae', 'ETT RAE')}{ckChip('lma', 'LMA')}{ckChip('mask', 'Mask')}</>)}
          {api.ck.lma && (
            <>
              {pick('LMA size', 'lmaSize', ['3', '4', '5'], true, 'other')}
              <label className="ifield" key="airMl">
                <span>Air in cuff (mL)</span>
                <input {...numPad} value={api.tx.airMl ?? ''} placeholder="mL" onChange={(e) => { api.setTx('airMl', e.target.value); api.setCk('air', e.target.value.trim() !== ''); api.setCk('lmaSizeCk', true); }} />
              </label>
            </>
          )}
          {pick('Tube size (mm)', 'tubeSize', ['6.0', '6.5', '7.0', '7.5', '8.0'], true, 'other')}
          {pick('Blade', 'blade', ['Mac', 'Miller', 'McGrath', 'Glidescope'], true, 'other')}
          {pick('Blade size', 'bladeSize', ['2', '3', '4'], true, 'other')}
          <div className="irow">
            {field('Length (lip)', 'tubeLength', 'cm')}
            {field('Time', 'ettTime', 'HHMM')}
            {field('# Attempts', 'attempts')}
          </div>
          {/* An induction is one or the other, so picking one drops the other. */}
          {group('Technique', <>{xckChip('rapidSequence', 'controlled', 'Rapid Sequence')}{xckChip('controlled', 'rapidSequence', 'Controlled')}{ckChip('cricoid', 'Cricoid Pressure')}{ckChip('lubricant', 'Lubricant')}{ckChip('trachSpray', 'Trach Spray')}</>)}
          {group('Cuff', <>{ckChip('cuffNone', 'None')}{ckChip('cuffInflated', 'Inflated')}</>)}
          {group('Ease', <>{ckChip('easy', 'Easy')}{ckChip('difficult', 'Difficult')}{ckChip('atraumatic', 'Atraumatic')}{ckChip('traumatic', 'Traumatic')}</>)}
          {api.ck.difficult && pick('Difficult airway — what was used', 'difficultAid', ['Bougie', 'McGrath', 'Glidescope', 'Stylet', 'Two-person mask', 'Fiberoptic'], true, 'other')}
          {api.ck.traumatic && (
            <label className="ifield" key="traumaDetail">
              <span>Trauma — what happened</span>
              <input {...noAuto} value={api.tx.traumaDetail ?? ''} placeholder="e.g. lip abrasion" onChange={(e) => api.setTx('traumaDetail', e.target.value)} />
            </label>
          )}
          {group('Breath sounds', <>{ckChip('bilateral', 'Bilateral')}{ckChip('equal', 'Equal')}</>)}
          {group('Other', <>{ckChip('arrivedIntubated', 'Arrived Intubated')}{ckChip('dentitionUnchanged', 'Dentition unchanged')}</>)}
        </>
      ),
    },
    {
      phase: 'Airway & positioning',
      title: 'Ventilator & gases',
      hint: 'Starting settings — each one holds across the chart until you change it, so you only enter it again when it actually changes.',
      render: () => (
        <>
          {settingRow('Oxygen', 'med0:0', 'L/min', [1, 2, 3, 4, 5], { min: 0, max: 10, inc: 0.5, start: 2 })}
          <div className="igroup" key="gaspick">
            <span>Second gas <span className="awiz-unit">one or the other</span></span>
            <div className="chips wrap">
              {chip(!!api.ck.n2o, () => { api.setCk('n2o', !api.ck.n2o); api.setCk('airMed', false); }, 'N₂O', 'gasN2O')}
              {chip(!!api.ck.airMed, () => { api.setCk('airMed', !api.ck.airMed); api.setCk('n2o', false); }, 'Air', 'gasAir')}
            </div>
          </div>
          {settingRow(api.ck.airMed ? 'Air' : 'N₂O', 'med1:0', 'L/min', [0, 1, 2, 3], { min: 0, max: 10, inc: 0.5, start: 2 })}
          {settingRow('ISO / SEVO', 'med2:0', 'ET%', [0.8, 1, 1.5, 2, 2.5], { min: 0, max: 8, inc: 0.1, start: 1.5 })}
          {settingRow('Vent mode', 'vmode:0', '', ['VC', 'PC', 'SIMV', 'PS', 'SV'])}
          {settingRow('Rate', 'vent0:0', 'breaths/min', [8, 10, 12, 14, 16], { min: 4, max: 30, inc: 1, start: 12 })}
          {settingRow('Tidal volume', 'vent1:0', 'mL', [400, 450, 500, 550, 600], { min: 200, max: 900, inc: 10, start: 500 })}
          {settingRow('FiO₂', 'vent2:0', 'fraction', ['.3', '.4', '.5', '.6', '1.0'], { min: 0.21, max: 1, inc: 0.05, start: 0.5 })}
          {settingRow('Inspiratory pressure', 'vent3:0', 'cm H₂O', [15, 18, 20, 22, 25], { min: 5, max: 40, inc: 1, start: 18 })}
        </>
      ),
    },
    {
      phase: 'Airway & positioning',
      title: 'Opening monitor values',
      hint: 'First readings off the monitor. These carry forward too — chart a new value only when it changes.',
      render: () => (
        <>
          {/* The first BP and heart rate: come back to this step any time —
              the boxes are the same ones sitting above the chart's graph. */}
          <div className="irow">
            {vitalField('BP systolic', 'sys')}
            {vitalField('BP diastolic', 'dia')}
            {vitalField('Heart rate', 'hr')}
          </div>
          {settingRow('EtCO₂', 'mon0:0', 'mmHg', [30, 32, 34, 36, 38], { min: 15, max: 65, inc: 1, start: 35 })}
          {settingRow('SaO₂', 'mon1:0', '%', [96, 97, 98, 99, 100], { min: 70, max: 100, inc: 1, start: 99 })}
          {settingRow('Temp', 'mon2:0', '°C', [35.5, 36, 36.5, 37])}
          {settingRow('EKG', 'mon3:0', 'rhythm', ['NSR', 'ST', 'SB', 'AF'])}
          {settingRow('Position', 'mon6:0', '', ['Sup', 'Pron', 'Lat', 'Bch', 'Lith'])}
          {settingRow('TO₄', 'mon7:0', 'twitches', [0, 1, 2, 3, 4], { min: 0, max: 4, inc: 1, start: 4 })}
        </>
      ),
    },
    {
      phase: 'Airway & positioning',
      title: 'Positioning',
      render: () => (
        <>
          {group('Head', <>{ckChip('pillow', 'Pillow')}{ckChip('gelDonut', 'Gel Donut')}{ckChip('foam', 'Foam')}{ckChip('alignment', 'Neck Alignment')}</>)}
          {group('Eyes', <>{ckChip('os', 'OS')}{ckChip('od', 'OD')}{ckChip('ou', 'OU')}{ckChip('lacriLube', 'Lacri Lube')}{ckChip('eyeTape', 'Tape')}</>)}
          {group('Arms / other', <>{ckChip('armL', 'Arm L tucked')}{ckChip('armR', 'Arm R tucked')}{ckChip('gelAxillaryRoll', 'Gel Axillary Roll')}{ckChip('ngOgTube', 'NG/OG Tube')}{ckChip('patientId', 'Patient ID verified')}</>)}
        </>
      ),
    },
    // ---------- Phase 3: End of case ----------
    {
      phase: 'End of case',
      title: 'Wheels down',
      hint: 'Landing the case: the gas comes off, the oxygen goes up, and the times go on the chart.',
      render: () => {
        // Where the landing writes on the grid: the anesthesia stop's column
        // if a stop is entered, otherwise right now — same clock math as the
        // chart itself.
        const start = parseHHMM(api.tx.anesStart ?? '') ?? parseHHMM(api.tx.surgStart ?? '');
        const stepMin = Number(api.tx.stepMin) > 0 ? Number(api.tx.stepMin) : 5;
        const n = new Date();
        const at = parseHHMM(api.tx.anesStop ?? '') ?? n.getHours() * 60 + n.getMinutes();
        let col = 35; // last grid column when there is no start to count from
        if (start != null) {
          let diff = at - start;
          if (diff < 0) diff += 24 * 60;
          col = Math.max(0, Math.min(35, Math.floor(diff / stepMin)));
        }
        const wokeUp = api.cells[`med2:${col}`] === 'off' && api.cells[`med0:${col}`] === '10';
        return (
          <>
            {group('Wake-up', chip(wokeUp, () => {
              api.setCell(`med2:${col}`, wokeUp ? '' : 'off');
              api.setCell(`med0:${col}`, wokeUp ? '' : '10');
              if (api.ck.n2o) api.setCell(`med1:${col}`, wokeUp ? '' : 'off');
            }, '💨 Gas off, O₂ up to 10'))}
            <div className="irow">
              {field('Surgery stop', 'surgStop', 'HHMM')}
              {field('Anesthesia stop', 'anesStop', 'HHMM')}
            </div>
            {group('Tourniquet', chip(api.tx.tt === 'N/A', () => api.setTx('tt', api.tx.tt === 'N/A' ? '' : 'N/A'), 'No tourniquet — N/A'))}
            {(api.tx.tt ?? '') !== 'N/A' && field('TT — tourniquet time', 'tt', 'HHMM')}
          </>
        );
      },
    },
    {
      phase: 'End of case',
      title: 'Emergence & reversal',
      hint: 'Doses drop into the grid near the anesthesia stop time.',
      render: () => (
        <>
          {drugDoses('Sugammadex', `oth3:${api.endCol}`, 'mg', [200, 400])}
          {drugDoses('Zofran (ondansetron)', `med8:${api.endCol}`, 'mg', [4])}
          {drugDoses('Decadron (dexamethasone)', `oth7:${api.endCol}`, 'mg', [4, 8, 10])}
        </>
      ),
    },

    {
      phase: 'End of case',
      title: 'Fluid totals',
      hint: 'Tap a common crystalloid total, or type any number below.',
      render: () => (
        <>
          <div className="igroup" key="crysPicks">
            <span>Crystalloid <span className="awiz-unit">mL</span></span>
            <div className="chips wrap">
              {[300, 500, 700, 900, 1000, 1500, 2000].map((v) =>
                chip(
                  api.tx.crystalloid === String(v),
                  () => api.setTx('crystalloid', api.tx.crystalloid === String(v) ? '' : String(v)),
                  String(v),
                  `crys${v}`,
                ),
              )}
            </div>
          </div>
          <div className="irow">
            {field('Crystalloid', 'crystalloid', 'mL')}
            {field('EBL', 'fluidEbl', 'mL')}
            {field('Urine', 'fluidUrine', 'mL')}
            {field('Blood', 'fluidBlood', 'mL')}
          </div>
        </>
      ),
    },
    {
      phase: 'End of case',
      title: 'Recovery & handoff',
      hint: 'Vitals the easy way: one tap takes the last set charted in the OR (change anything after), or tap the systolic box and just type — it hops to diastolic, then O₂, pulse and resps by itself.',
      render: () => {
        // The last reading charted on the graph, offered as the PACU set.
        const lastOf = (s: Series): number | null => {
          const cols = Object.keys(api.vitals[s]).map(Number).filter((n) => Number.isFinite(n));
          return cols.length ? api.vitals[s][Math.max(...cols)] : null;
        };
        const ls = lastOf('sys');
        const ld = lastOf('dia');
        const lh = lastOf('hr');
        const offer = (ls && ld) || lh;
        return (
        <>
          {offer && (
            <div className="chips" key="lastor">
              <button
                type="button"
                className="chip"
                onClick={() => {
                  if (ls && ld) api.setTx('recBp', `${ls}/${ld}`);
                  if (lh) api.setTx('recP', String(lh));
                }}
              >
                ⬇ Same as last OR vitals{ls && ld ? ` — ${ls}/${ld}` : ''}{lh ? ` · P ${lh}` : ''}
              </button>
            </div>
          )}
          {pick('To', 'recLocation', ['PACU', 'Unit'], true, 'other')}
          {api.tx.recLocation === 'Unit' && (
            <label className="ifield" key="recRoom">
              <span>Room</span>
              <input {...numPad} value={api.tx.recRoom ?? ''} placeholder="room #" onChange={(e) => api.setTx('recRoom', e.target.value)} />
            </label>
          )}
          <div className="irow">
            {field('Time', 'recTime', 'HHMM')}
            {bpBoxes()}
            {field('O₂ Sat', 'recO2')}
            {field('P', 'recP')}
            {field('R', 'recR')}
            {field('T', 'recT')}
          </div>
          {group('Status', <>{ckChip('awake', 'Awake')}{ckChip('drowsy', 'Drowsy')}{ckChip('somnolent', 'Somnolent')}{ckChip('stable', 'Stable')}{ckChip('unstable', 'Unstable')}</>)}
          {group('Airway / O₂', <>{ckChip('recNasalO2', 'Nasal O₂')}{ckChip('maskO2', 'Mask O₂')}{ckChip('recIntubated', 'Intubated')}{ckChip('tPiece', 'T-piece')}{ckChip('recVentilator', 'Ventilator')}{ckChip('oralNasalAirway', 'Oral/Nasal Airway')}{ckChip('recLma', 'LMA')}</>)}
          {group('Handoff', <>{ckChip('reportToRn', 'Report to RN')}{ckChip('recDentition', 'Dentition unchanged')}</>)}
          {field('Transfer care (time)', 'transferCare', 'HHMM')}
        </>
        );
      },
    },
    {
      phase: 'End of case',
      title: 'Narration',
      hint: 'Free-text notes — type, or use your stylus/finger with the on-screen keyboard. This fills the record’s Remarks. Save it to a provider to reuse your usual narrative.',
      render: () => (
        <label className="ifield awiz-narration" key="remarks">
          <span>Narrative / Remarks</span>
          <button
            type="button"
            className="chip"
            onClick={(e) => {
              e.preventDefault();
              const draft = composeNarrative(api.ck, api.tx, api.cells);
              if (!draft) { window.alert('Nothing charted yet to draft from.'); return; }
              if (!api.tx.remarks || window.confirm('Replace the current remarks with a fresh draft from the chart?')) {
                api.setTx('remarks', draft);
              }
            }}
          >
            ⚡ Draft from chart
          </button>
          <textarea
            {...noAuto}
            rows={8}
            value={api.tx.remarks ?? ''}
            placeholder="e.g. Patient tolerated procedure well, hemodynamically stable throughout, extubated awake and taken to PACU in stable condition…"
            onChange={(e) => api.setTx('remarks', e.target.value)}
          />
        </label>
      ),
    },
  ];

  // Landing the case: open at the first end-of-case step, once.
  if (!jumped && startPhase) {
    const at = steps.findIndex((s) => s.phase === startPhase);
    setJumped(true);
    if (at >= 0 && at !== step) {
      setStep(at);
      return null;
    }
  }

  const cur = steps[step];
  const phaseStart = steps.findIndex((s) => s.phase === cur.phase);
  const phaseSteps = steps.filter((s) => s.phase === cur.phase);
  const phaseIdx = step - phaseStart;

  return (
    <div className="intake screen-only awiz">
      <div className="awiz-top">
        <div className="awiz-secnav">
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={`awiz-secbtn${i === step ? ' on' : ''}`}
              onClick={() => setStep(i)}
              title={`${s.phase}: ${s.title}`}
            >
              {NAV_SHORT[s.title] ?? s.title}
            </button>
          ))}
        </div>
        <div className="awiz-progress">
          <div className="fbf-bar"><div className="fbf-fill" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
          <span className="fbf-count">{step + 1} of {steps.length}</span>
        </div>
      </div>

      <section className="icard fbf-card">
        <p className="fbf-hint">{cur.phase} · {phaseIdx + 1} of {phaseSteps.length}</p>
        {cur.hint && <p className="fbf-hint">{cur.hint}</p>}
        <h2>{cur.title}</h2>
        {cur.render()}
      </section>

      <div className="fbf-nav">
        <button type="button" className="fbf-back" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          ← Back
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className="fbf-next" onClick={() => setStep((s) => s + 1)}>Next →</button>
        ) : (
          <button type="button" className="fbf-next" onClick={api.onDone}>Done — go to chart</button>
        )}
      </div>
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import { noAuto } from './inputProps';

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
  endCol: number;
  onDone: () => void;
}

interface Step {
  phase: string;
  title: string;
  hint?: string;
  render: () => ReactNode;
}

export default function AnesWizard(api: WizardApi) {
  const [step, setStep] = useState(0);

  const chip = (active: boolean, onClick: () => void, label: string, key?: string) => (
    <button key={key ?? label} type="button" className={`chip${active ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
  const ckChip = (k: string, label: string) => chip(!!api.ck[k], () => api.setCk(k, !api.ck[k]), label, k);
  const field = (label: string, k: string, ph = '') => (
    <label className="ifield" key={k}>
      <span>{label}</span>
      <input {...noAuto} value={api.tx[k] ?? ''} placeholder={ph} onChange={(e) => api.setTx(k, e.target.value)} />
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
          <input {...noAuto} className="awiz-doseinput" placeholder={ph || 'other'} value={opts.includes(api.tx[k]) ? '' : (api.tx[k] ?? '')} onChange={(e) => api.setTx(k, e.target.value)} />
        )}
      </div>
    </div>
  );
  // A drug with common-dose quick-pick chips that fill the grid cell.
  const drugDoses = (label: string, cellKey: string, unit: string, doses: number[]) => (
    <div className="igroup" key={cellKey}>
      <span>{label} <span className="awiz-unit">{unit}</span></span>
      <div className="chips wrap">
        {doses.map((dv) => chip(api.cells[cellKey] === String(dv), () => api.setCell(cellKey, api.cells[cellKey] === String(dv) ? '' : String(dv)), String(dv), cellKey + dv))}
        <input {...noAuto} className="awiz-doseinput" inputMode="numeric" placeholder="other" value={doses.map(String).includes(api.cells[cellKey]) ? '' : (api.cells[cellKey] ?? '')} onChange={(e) => api.setCell(cellKey, e.target.value)} />
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
      hint: 'The surgery start time anchors the charting grid.',
      render: () => (
        <div className="irow">
          {field('Anesthesia start', 'anesStart', 'HHMM')}
          {field('Surgery start', 'surgStart', 'HHMM')}
        </div>
      ),
    },
    {
      phase: 'Start of case',
      title: 'Monitors',
      hint: 'Everything on the patient.',
      render: () => (
        <>
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
          {pick('Local at site', 'ivLocal', ['Lidocaine', 'None'])}
          {field('Started by / time', 'ivStar', 'e.g. RN / 0715')}
        </>
      ),
    },
    {
      phase: 'Start of case',
      title: 'ASA physical status',
      render: () =>
        group('ASA', <>{['1', '2', '3', '4', '5'].map((n) => chip(api.ck[`asa${n}`], () => api.setCk(`asa${n}`, !api.ck[`asa${n}`]), n, `asa${n}`))}{ckChip('asaE', 'E (Emergency)')}</>),
    },
    {
      phase: 'Start of case',
      title: 'Induction drugs',
      hint: 'Tap the common dose or type another — these drop into the first (surgery-start) grid column.',
      render: () => (
        <>
          {drugDoses('Propofol', 'med3:0', 'mg', [100, 150, 200])}
          {drugDoses('Fentanyl', 'med6:0', 'mcg', [50, 100, 150, 250])}
          {drugDoses('Versed', 'med7:0', 'mg', [1, 2])}
          {drugDoses('Rocuronium', 'med5:0', 'mg', [30, 50])}
          {drugDoses('Succinylcholine', 'med4:0', 'mg', [100])}
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
          {group('Type', <>{ckChip('ettOral', 'Oral')}{ckChip('ettNasal', 'Nasal')}{ckChip('ettRae', 'RAE')}{ckChip('lma', 'LMA')}</>)}
          {pick('Tube size (mm)', 'tubeSize', ['6.0', '6.5', '7.0', '7.5', '8.0'], true, 'other')}
          <div className="irow">
            {field('Length (lip)', 'tubeLength', 'cm')}
            {field('Time', 'ettTime', 'HHMM')}
            {field('# Attempts', 'attempts')}
          </div>
          {group('Technique', <>{ckChip('rapidSequence', 'Rapid Sequence')}{ckChip('cricoid', 'Cricoid Pressure')}{ckChip('lubricant', 'Lubricant')}{ckChip('trachSpray', 'Trach Spray')}</>)}
          {group('Cuff', <>{ckChip('cuffNone', 'None')}{ckChip('cuffInflated', 'Inflated')}</>)}
          {group('Ease', <>{ckChip('easy', 'Easy')}{ckChip('difficult', 'Difficult')}{ckChip('atraumatic', 'Atraumatic')}{ckChip('traumatic', 'Traumatic')}</>)}
          {group('Breath sounds', <>{ckChip('bilateral', 'Bilateral')}{ckChip('equal', 'Equal')}</>)}
          {group('Other', <>{ckChip('arrivedIntubated', 'Arrived Intubated')}{ckChip('dentitionUnchanged', 'Dentition unchanged')}</>)}
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
    // ---------- Phase 3: Regional / blocks ----------
    {
      phase: 'Regional / blocks',
      title: 'Block type',
      hint: 'Skip if none — tap Next.',
      render: () => group('Conduction anesthesia', <>{ckChip('spinal', 'Spinal')}{ckChip('epidural', 'Epidural')}{ckChip('bier', 'Bier')}{ckChip('axillary', 'Axillary')}{ckChip('local', 'Local')}{ckChip('condOther', 'Other')}</>),
    },
    {
      phase: 'Regional / blocks',
      title: 'Block agents & details',
      render: () => (
        <>
          <div className="irow">
            {field('Duramorph mg', 'duramorph')}
            {field('Fentanyl mcg', 'fentanyl')}
            {field('Naropin mL', 'naropin')}
            {field('Sensorcaine mL', 'sensorcaine')}
            {field('Xylocaine mL', 'xylocaine')}
          </div>
          <div className="irow">
            {field('Needle size', 'needleSize')}
            {field('# Attempts', 'condAttempts')}
            {field('Site', 'site')}
            {field('Time', 'condTime', 'HHMM')}
          </div>
          {group('Findings', <>{ckChip('paresthesia', 'Paresthesia')}{ckChip('cffcsf', 'CFF/CSF')}</>)}
          <div className="irow">
            {field('Lot #', 'lotNum')}
            {field('Expiration', 'expDate')}
            {field('Manufacturer', 'manufacturer')}
          </div>
        </>
      ),
    },
    // ---------- Phase 4: End of case ----------
    {
      phase: 'End of case',
      title: 'Emergence & reversal',
      hint: 'Sugammadex dose — drops into the grid near the anesthesia stop time.',
      render: () => drugDoses('Sugammadex', `oth3:${api.endCol}`, 'mg', [200, 500]),
    },
    {
      phase: 'End of case',
      title: 'Stop times',
      hint: 'The anesthesia stop time ends the BP/HR graph.',
      render: () => (
        <div className="irow">
          {field('Surgery stop', 'surgStop', 'HHMM')}
          {field('Anesthesia stop', 'anesStop', 'HHMM')}
        </div>
      ),
    },
    {
      phase: 'End of case',
      title: 'Fluid totals',
      render: () => (
        <div className="irow">
          {field('Crystalloid', 'crystalloid', 'mL')}
          {field('EBL', 'fluidEbl', 'mL')}
          {field('Urine', 'fluidUrine', 'mL')}
          {field('Blood', 'fluidBlood', 'mL')}
        </div>
      ),
    },
    {
      phase: 'End of case',
      title: 'Recovery & handoff',
      render: () => (
        <>
          <div className="irow">
            {field('Location', 'recLocation')}
            {field('Time', 'recTime', 'HHMM')}
            {field('BP', 'recBp')}
            {field('O₂ Sat', 'recO2')}
            {field('P', 'recP')}
            {field('R', 'recR')}
            {field('T', 'recT')}
          </div>
          {group('Status', <>{ckChip('awake', 'Awake')}{ckChip('drowsy', 'Drowsy')}{ckChip('somnolent', 'Somnolent')}{ckChip('stable', 'Stable')}{ckChip('unstable', 'Unstable')}</>)}
          {group('Airway / O₂', <>{ckChip('recNasalO2', 'Nasal O₂')}{ckChip('maskO2', 'Mask O₂')}{ckChip('recIntubated', 'Intubated')}{ckChip('tPiece', 'T-piece')}{ckChip('recVentilator', 'Ventilator')}{ckChip('oralNasalAirway', 'Oral/Nasal Airway')}</>)}
          {group('Handoff', <>{ckChip('reportToRn', 'Report to RN')}{ckChip('recDentition', 'Dentition unchanged')}</>)}
        </>
      ),
    },
  ];

  const cur = steps[step];
  const phaseStart = steps.findIndex((s) => s.phase === cur.phase);
  const phaseSteps = steps.filter((s) => s.phase === cur.phase);
  const phaseIdx = step - phaseStart;

  return (
    <div className="intake screen-only awiz">
      <div className="awiz-top">
        <div className="awiz-phases">
          {['Start of case', 'Airway & positioning', 'Regional / blocks', 'End of case'].map((ph) => (
            <span key={ph} className={`awiz-phase${cur.phase === ph ? ' on' : ''}`}>{ph}</span>
          ))}
        </div>
        <div className="fbf-bar"><div className="fbf-fill" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <span className="fbf-count">{step + 1} of {steps.length}</span>
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

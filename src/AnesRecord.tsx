import { useEffect, useState } from 'react';
import Barcode39 from './Barcode39';
import { noAuto } from './inputProps';

// Intra-op Anesthesia Record replicating Mountain West Medical Center form
// 170-165-MW25004 (03/08, Rev. 06/15). Landscape US Letter. The setup
// sections are fillable on screen; the vitals grid and medication rows print
// as ruled grid for hand-charting during the case. Like the pre-anesthesia
// form, no patient identifiers — the label sticker is applied after printing.

const KEY = 'anes-record-draft-v1';

interface AnesDraft {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
}

function loadAnes(): AnesDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ck: {}, tx: {} };
    const parsed = JSON.parse(raw) as Partial<AnesDraft>;
    return { ck: parsed.ck ?? {}, tx: parsed.tx ?? {} };
  } catch {
    return { ck: {}, tx: {} };
  }
}

export function clearAnesDraft(): void {
  localStorage.removeItem(KEY);
}

const MED_ROWS = [
  'Oxygen (L/minute)',
  'N₂O/Air (L/minute)',
  'ISO/SEVO/ET%',
  'PROPOFOL IV mg',
  'ANECTINE IV mg',
  'VEC/ROC IV mg',
  'SUFENTA/SUBLIMAZE IV mcg',
  'VERSED IV mg',
  'REGLAN/ZOFRAN IV mg',
];

const OTHER_ROWS = ['TORADOL IV mg', 'ROBINUL IV mg', 'NEO IV mg', 'LR/D5LR/NS'];

const VENT_ROWS = ['Rate', 'Volume', 'FiO₂', 'Inspiratory Pressure', 'EtCO₂'];

const MONITOR_ROWS = ['SaO₂', 'Temp', 'EKG', 'Urine', 'EBL', 'POS', 'TO₄'];

const VS_SCALE = [200, 180, 160, 140, 120, 100, 80, 60, 40, 20, 0];

export default function AnesRecord() {
  const [d, setD] = useState<AnesDraft>(loadAnes);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(d));
  }, [d]);

  const ck = (k: string, label?: string) => (
    <label className="ck" key={k}>
      <input
        type="checkbox"
        checked={!!d.ck[k]}
        onChange={(e) => setD((p) => ({ ...p, ck: { ...p.ck, [k]: e.target.checked } }))}
      />
      {label && <span>{label}</span>}
    </label>
  );

  const tx = (k: string, cls = '') => (
    <input
      {...noAuto}
      className={`t u ${cls}`}
      value={d.tx[k] ?? ''}
      onChange={(e) => setD((p) => ({ ...p, tx: { ...p.tx, [k]: e.target.value } }))}
    />
  );

  const chartRow = (label: string, key: string) => (
    <div className="ar-crow" key={key}>
      <div className="ar-clabel">{label}</div>
      <div className="ar-cgrid" />
      <div className="ar-ctotal" />
    </div>
  );

  return (
    <div className="ar-wrap">
      <style>{'@media print { @page { size: letter landscape; margin: 0.3in; } }'}</style>
      <div className="ar">
        <div className="ar-top">
          <div className="ar-toprow">
            <span className="cell">{ck('hp', 'H&P')}</span>
            <span className="cell">{ck('opPermit', 'OP Permit')}</span>
            <span className="cell"><span className="lbl">OR #</span>{tx('orNum', 'short')}</span>
            <span className="cell">{ck('consent', 'Anesthesia Consent')}</span>
            <span className="cell"><span className="lbl">Date</span>{tx('date', 'med')}</span>
            <span className="cell">{ck('chartReviewed', 'Chart Reviewed')}</span>
            <span className="cell grow"><span className="lbl">Allergies</span>{tx('allergies', 'wide')}</span>
          </div>
          <div className="ar-bc">
            <Barcode39 value="ANES" />
            <div className="bc-caption">*ANES*</div>
          </div>
        </div>

        <div className="ar-sections">
          <div className="ar-sec">
            <div className="ar-h">Safety</div>
            {ck('gasCheck', 'Gas Machine Check')}
            {ck('equipCheck', 'Equipment Check')}
            {ck('disconnect', 'Disconnect')}
            <div className="ar-h">Techniques</div>
            {ck('regional', 'Regional')}
            {ck('general', 'General')}
            {ck('mac', 'MAC')}
            <div className="ar-h">Symbols</div>
            <div className="ar-sym"><span className="b">X</span> Anesthesia</div>
            <div className="ar-sym"><span className="b">&#8857;</span> Operator</div>
            <div className="ar-sym"><span className="b">X</span> BP Cuff Pressure</div>
            <div className="ar-sym"><span className="b">&#8869;&#8868;</span> Arterial Line Pressure</div>
            <div className="ar-sym"><span className="b">&#9650;</span> Mean Arterial Pressure</div>
            <div className="ar-sym"><span className="b">&#9679;</span> Pulse</div>
            <div className="ar-sym"><span className="b">O/S</span> Spont Resp</div>
            <div className="ar-sym"><span className="b">&Oslash;/A</span> Assisted Resp</div>
            <div className="ar-sym"><span className="b">&#8855;/C</span> Controlled Resp</div>
            <div className="ar-sym"><span className="b">T</span> Tourniquet</div>
          </div>

          <div className="ar-sec">
            <div className="ar-h">Ventilation</div>
            {ck('mask', 'Mask')}
            {ck('intubated', 'Intubated')}
            {ck('manual', 'Manual')}
            {ck('ventilator', 'Ventilator')}
            {ck('nonRebreather', 'Non-rebreather')}
            {ck('semiClosed', 'Semi-Closed Circ')}
            {ck('oralAirway', 'Oral Airway')}
            {ck('nasalAirway', 'Nasal Airway')}
            {ck('nasalCannula', 'Nasal Cannula')}
            {ck('simpleFaceMask', 'Simple Face Mask')}
            <div className="ar-line">{ck('lma', 'LMA')} <span>Size</span>{tx('lmaSize', 'xshort')}</div>
            <div className="ar-line">{ck('air', 'Air')}{tx('airMl', 'xshort')} <span>mL</span></div>
          </div>

          <div className="ar-sec">
            <div className="ar-h">Endotracheal</div>
            <div className="ar-line">{ck('ettOral', 'Oral')}{ck('ettNasal', 'Nasal')}{ck('ettRae', 'RAE')}</div>
            <div className="ar-line"><span>Tube size</span>{tx('tubeSize', 'xshort')} <span>mm</span></div>
            <div className="ar-line"><span>Length</span>{tx('tubeLength', 'xshort')} <span>cm (Lip)</span></div>
            <div className="ar-line">{ck('lubricant', 'Lubricant')}{ck('trachSpray', 'Trach Spray')}</div>
            {ck('rapidSequence', 'Rapid Sequence')}
            {ck('cricoid', 'Cricoid Pressure')}
            <div className="ar-line"><span className="b">CUFF:</span>{ck('cuffNone', 'None')}{ck('cuffInflated', 'Inflated')}</div>
            <div className="ar-line">{ck('easy', 'Easy')}{ck('difficult', 'Difficult')}</div>
            <div className="ar-line">{ck('atraumatic', 'Atraumatic')}{ck('traumatic', 'Traumatic')}</div>
            <div className="ar-line"><span className="b">BREATH SOUNDS:</span></div>
            <div className="ar-line">{ck('bilateral', 'Bilateral')}{ck('equal', 'Equal')}</div>
            <div className="ar-line"><span>TIME:</span>{tx('ettTime', 'short')}</div>
            <div className="ar-line"><span># Attempts</span>{tx('attempts', 'xshort')}</div>
            {ck('arrivedIntubated', 'Arrived Intubated')}
            {ck('dentitionUnchanged', 'Dentition unchanged')}
          </div>

          <div className="ar-sec">
            <div className="ar-h">Monitors</div>
            <div className="ar-line"><span className="b">BP:</span>{ck('bpAuto', 'Auto')}{ck('bpManual', 'Manual')}{ck('bpL', 'L')}{ck('bpR', 'R')}</div>
            <div className="ar-line">{ck('bpArm', 'Arm')}{ck('bpLeg', 'Leg')}</div>
            <div className="ar-line"><span className="b">STETH:</span>{ck('stethE', 'E')}{ck('stethP', 'P')}{ck('doppler', 'Doppler')}</div>
            {ck('nerveStim', 'Nerve Stimulator')}
            {ck('pulseOx', 'Pulse Oximeter')}
            {ck('capnography', 'Capnography')}
            {ck('ecg', 'ECG')}
            <div className="ar-line"><span>Temp</span>{ck('tempE', 'E')}{ck('tempSk', 'SK')}{ck('tempBlad', 'Blad')}{ck('tempR', 'R')}</div>
            <div className="ar-line">{ck('o2Analyzer', 'O₂ Analyzer')}{ck('calibrated', 'Calibrated')}</div>
            <div className="ar-line"><span className="b">WARMER:</span>{ck('warmerIv', 'IV Blood')}</div>
            <div className="ar-line">{ck('bairHugger', 'Bair Hugger')}{ck('hme', 'HME Temp')}</div>
            <div className="ar-line"><span>Arterial Line</span>{ck('artL', 'L')}{ck('artR', 'R')}</div>
            <div className="ar-line">{ck('cvp', 'CVP')}{ck('swanGanz', 'Swan-Ganz')}</div>
            <div className="ar-line"><span>IV</span>{ck('ivL', 'L')}{ck('ivR', 'R')}</div>
          </div>

          <div className="ar-sec">
            <div className="ar-h">Positioning</div>
            <div className="ar-line"><span className="b">HEAD:</span>{ck('pillow', 'Pillow')}</div>
            <div className="ar-line">{ck('gelDonut', 'Gel Donut')}{ck('foam', 'Foam')}</div>
            <div className="ar-line"><span className="b">NECK:</span>{ck('alignment', 'Alignment')}</div>
            <div className="ar-line"><span className="b">EYES:</span>{ck('os', 'OS')}{ck('od', 'OD')}{ck('ou', 'OU')}</div>
            <div className="ar-line">{ck('lacriLube', 'Lacri Lube')}{ck('eyeTape', 'Tape')}</div>
            <div className="ar-line"><span className="b">ARM:</span> <span>Tucked/padded</span></div>
            <div className="ar-line">{ck('armL', 'L')}{ck('armR', 'R')}</div>
            {ck('gelAxillaryRoll', 'Gel Axillary Roll')}
            {ck('ngOgTube', 'NG/OG Tube')}
            {ck('patientId', 'Patient Identification')}
          </div>

          <div className="ar-sec ar-conduction">
            <div className="ar-h">Conduction Anesthesia</div>
            <div className="ar-line">{ck('spinal', 'Spinal')}{ck('epidural', 'Epidural')}{ck('bier', 'Bier')}</div>
            <div className="ar-line">{ck('axillary', 'Axillary')}{ck('condOther', 'Other')}{ck('local', 'Local')}</div>
            <div className="ar-line"><span>Duramorph</span>{tx('duramorph', 'xshort')} <span>mg</span></div>
            <div className="ar-line"><span>Fentanyl</span>{tx('fentanyl', 'xshort')} <span>mcg</span></div>
            <div className="ar-line"><span>Sufenta</span>{tx('sufenta', 'xshort')} <span>mcg</span></div>
            <div className="ar-line"><span>Naropin</span>{tx('naropin', 'xshort')} <span>mL</span></div>
            <div className="ar-line"><span>Nesacaine</span>{tx('nesacaine', 'xshort')} <span>mL</span></div>
            <div className="ar-line"><span>Sensorcaine</span>{tx('sensorcaine', 'xshort')} <span>mL</span></div>
            <div className="ar-line"><span>Xylocaine</span>{tx('xylocaine', 'xshort')} <span>mL</span></div>
            <div className="ar-line"><span>Other</span>{tx('condOther1', 'short')}</div>
            <div className="ar-line"><span>Needle Size</span>{tx('needleSize', 'xshort')}</div>
            <div className="ar-line"><span># Attempts</span>{tx('condAttempts', 'xshort')}</div>
            <div className="ar-line"><span>Site</span>{tx('site', 'short')}</div>
            <div className="ar-line">{ck('paresthesia', 'Paresthesia')}{ck('cffcsf', 'CFFCSF')}</div>
            <div className="ar-line"><span>Time</span>{tx('condTime', 'short')}</div>
            <div className="ar-line"><span>Lot #</span>{tx('lotNum', 'short')}</div>
            <div className="ar-line"><span>Expiration Date</span>{tx('expDate', 'short')}</div>
            <div className="ar-line"><span>Manufacturer</span>{tx('manufacturer', 'short')}</div>
          </div>
        </div>

        <div className="ar-main">
          <div className="ar-chart">
            <div className="ar-bandlabel">Medications</div>
            {MED_ROWS.map((r, i) => chartRow(r, `med${i}`))}
            <div className="ar-bandlabel">Other</div>
            {OTHER_ROWS.map((r, i) => chartRow(r, `oth${i}`))}
            <div className="ar-bandlabel">Vital Signs</div>
            {VS_SCALE.map((n) => (
              <div className="ar-crow vs" key={`vs${n}`}>
                <div className="ar-clabel num">{n}</div>
                <div className="ar-cgrid" />
                <div className="ar-ctotal noline" />
              </div>
            ))}
            <div className="ar-bandlabel">Vent</div>
            {VENT_ROWS.map((r, i) => chartRow(r, `vent${i}`))}
            <div className="ar-bandlabel">Monitors</div>
            {MONITOR_ROWS.map((r, i) => chartRow(r, `mon${i}`))}
            <div className="ar-crow">
              <div className="ar-clabel">Symbols for Remarks</div>
              <div className="ar-cgrid" />
              <div className="ar-ctotal noline" />
            </div>
            <div className="ar-tothead">Totals</div>
          </div>

          <div className="ar-right">
            <div className="ar-h">Remarks</div>
            <div className="ar-line"><span>TIME:</span>{tx('remarkTime', 'short')}</div>
            {ck('preInduction', 'Pre-induction anesthestic reassessment')}
            <textarea
              {...noAuto}
              className="a ar-remarks"
              rows={4}
              value={d.tx.remarks ?? ''}
              onChange={(e) => setD((p) => ({ ...p, tx: { ...p.tx, remarks: e.target.value } }))}
            />
            <div className="ar-h">Fluid Totals</div>
            <div className="ar-line"><span>Crystalloid</span>{tx('crystalloid', 'short')}</div>
            <div className="ar-line"><span>EBL</span>{tx('fluidEbl', 'short')}</div>
            <div className="ar-line"><span>Urine</span>{tx('fluidUrine', 'short')}</div>
            <div className="ar-line"><span>Blood</span>{tx('fluidBlood', 'short')}</div>
            <div className="ar-h">Recovery</div>
            <div className="ar-line"><span>Location</span>{tx('recLocation', 'short')} <span>Time</span>{tx('recTime', 'short')}</div>
            <div className="ar-line"><span>BP</span>{tx('recBp', 'xshort')} <span>O&#8322; Sat</span>{tx('recO2', 'xshort')} <span>P</span>{tx('recP', 'xshort')}</div>
            <div className="ar-line"><span>R</span>{tx('recR', 'xshort')} <span>T</span>{tx('recT', 'xshort')}</div>
            <div className="ar-line">{ck('recDentition', 'Dentition unchanged')}{ck('reportToRn', 'Report to RN')}</div>
            <div className="ar-line">{ck('awake', 'Awake')}{ck('stable', 'Stable')}{ck('recNasalO2', 'Nasal Oxygen')}</div>
            <div className="ar-line">{ck('drowsy', 'Drowsy')}{ck('unstable', 'Unstable')}{ck('maskO2', 'Mask Oxygen')}</div>
            <div className="ar-line">{ck('somnolent', 'Somnolent')}{ck('recIntubated', 'Intubated')}</div>
            <div className="ar-line">{ck('tPiece', 'T-piece Oxygen')}{ck('unarousable', 'Unarousable')}</div>
            <div className="ar-line">{ck('recVentilator', 'Ventilator')}{ck('oralNasalAirway', 'Oral/Nasal Airway')}</div>
          </div>
        </div>

        <div className="ar-bottom">
          <div className="ar-brow">
            <span className="cell"><span className="lbl">IV Star</span>{tx('ivStar', 'short')}</span>
            <span className="cell"><span className="lbl">Size</span>{tx('ivSize', 'xshort')}</span>
            <span className="cell"><span className="lbl">Area</span>{tx('ivArea', 'short')}</span>
            <span className="cell"><span className="lbl">Local</span>{tx('ivLocal', 'short')}</span>
            <span className="cell grow"><span className="lbl">Surgeon(s)</span>{tx('surgeons', 'wide')}</span>
            <span className="cell grow"><span className="lbl">Anesthetist</span>{tx('anesthetist', 'wide')}</span>
          </div>
          <div className="ar-brow">
            <span className="cell grow"><span className="lbl">Procedure</span>{tx('procedure', 'wide')}</span>
            <span className="cell"><span className="lbl">Anesthesia Start</span>{tx('anesStart', 'short')}</span>
            <span className="cell"><span className="lbl">Stop</span>{tx('anesStop', 'short')}</span>
            <span className="cell"><span className="lbl">Surgery Start</span>{tx('surgStart', 'short')}</span>
            <span className="cell"><span className="lbl">Stop</span>{tx('surgStop', 'short')}</span>
          </div>
          <div className="ar-brow">
            <span className="cell grow"><span className="lbl">Diagnosis</span>{tx('diagnosis', 'wide')}</span>
            <span className="cell">
              <span className="lbl">ASA</span>
              {ck('asa1', '1')}{ck('asa2', '2')}{ck('asa3', '3')}{ck('asa4', '4')}{ck('asa5', '5')}{ck('asaE', 'E')}
            </span>
          </div>
        </div>

        <div className="ar-foot">
          <div>
            <div className="ar-foot-title">Anesthesia Record</div>
            <div>170-165-MW25004&#8201;6HMS&nbsp;&nbsp;&nbsp;03/08 (Rev. 06/15)&nbsp;&nbsp;&nbsp;Page 1 of 1</div>
            <div>ORIGINAL &ndash; Medical Record&nbsp;&nbsp;&nbsp;COPY &ndash; Anesthesia Department&nbsp;&nbsp;&nbsp;COPY &ndash; Pharmacy</div>
            <div>Mountain West Medical Center</div>
          </div>
          <div className="ar-plabel">Patient Label</div>
        </div>
      </div>
    </div>
  );
}

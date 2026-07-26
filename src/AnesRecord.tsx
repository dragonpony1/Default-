import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { noAuto } from './inputProps';
import { useCaseData, setCaseField } from './caseData';
import VitalsGraph, { type VitalsData, type Series } from './VitalsGraph';
import AnesWizard from './AnesWizard';

// Intra-op Anesthesia Record replicating Mountain West Medical Center form
// 170-165-MW250046HMS (03/08, Rev. 06/15), portrait US Letter, built from a
// flat scan of the original. Setup sections are fillable on screen; the
// charting band prints as ruled grid for hand-charting during the case.
// No patient identifiers — the label sticker is applied after printing.

const KEY = 'anes-record-draft-v1';

// The charting grid is a time axis: COLS columns of STEP minutes each,
// anchored to the surgery start time entered on the record. 36 × 5 min = 3 h.
const STEP = 5;
const COLS = 36;

interface AnesDraft {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
  cells: Record<string, string>;
  vitals: VitalsData;
}

const emptyVitals = (): VitalsData => ({ sys: {}, dia: {}, hr: {} });

function loadAnes(): AnesDraft {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ck: {}, tx: {}, cells: {}, vitals: emptyVitals() };
    const parsed = JSON.parse(raw) as Partial<AnesDraft>;
    return {
      ck: parsed.ck ?? {},
      tx: parsed.tx ?? {},
      cells: parsed.cells ?? {},
      vitals: { ...emptyVitals(), ...parsed.vitals },
    };
  } catch {
    return { ck: {}, tx: {}, cells: {}, vitals: emptyVitals() };
  }
}

// Parse "0730", "7:30", "730" → minutes since midnight, or null.
function parseTime(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Column clock labels from the start time; blank until a valid start is set.
function columnTimes(start: string): string[] {
  const base = parseTime(start);
  if (base == null) return Array(COLS).fill('');
  return Array.from({ length: COLS }, (_, i) => {
    const t = (base + i * STEP) % (24 * 60);
    return String(Math.floor(t / 60)).padStart(2, '0') + String(t % 60).padStart(2, '0');
  });
}

export function clearAnesDraft(): void {
  localStorage.removeItem(KEY);
}

export default function AnesRecord({ resetSignal = 0 }: { resetSignal?: number }) {
  const [d, setD] = useState<AnesDraft>(loadAnes);
  const caseData = useCaseData(); // shared allergies (pre-populated from pre-op)
  const [mode, setMode] = useState<'chart' | 'wizard'>('chart');
  const [zoom, setZoom] = useState(1);
  const bumpZoom = (delta: number) => setZoom((z) => Math.min(2.5, Math.max(0.8, Math.round((z + delta) * 10) / 10)));
  // Zoom via transform scale (not CSS `zoom`, which breaks pointer-drag math).
  // Reserve the scaled footprint on a wrapper so the pane scrolls to it.
  const arRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (arRef.current) setNatural({ w: arRef.current.offsetWidth, h: arRef.current.offsetHeight });
  }, [mode, d]);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(d));
  }, [d]);

  // Clear form bumps resetSignal — reload from the (now-cleared) storage
  // directly so the mounted record can't autosave stale data back.
  const seenReset = useRef(resetSignal);
  useEffect(() => {
    if (resetSignal !== seenReset.current) {
      seenReset.current = resetSignal;
      setD(loadAnes());
      setMode('chart');
    }
  }, [resetSignal]);

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

  const setCell = (k: string, v: string) =>
    setD((p) => ({ ...p, cells: { ...p.cells, [k]: v } }));

  const setVitals = (next: VitalsData) => setD((p) => ({ ...p, vitals: next }));

  // First reading of a series → column 0; the overlay carries it forward.
  const firstReading = (series: Series, label: string) => (
    <label className="vg-first-field">
      <span>{label}</span>
      <input
        {...noAuto}
        inputMode="numeric"
        value={d.vitals[series][0] ?? ''}
        onChange={(e) => {
          const raw = e.target.value.trim();
          setD((p) => {
            const s = { ...p.vitals[series] };
            if (raw === '') delete s[0];
            else s[0] = Math.max(0, Math.min(200, Math.round(Number(raw) || 0)));
            return { ...p, vitals: { ...p.vitals, [series]: s } };
          });
        }}
      />
    </label>
  );

  const times = columnTimes(d.tx.surgStart ?? '');

  // Vital-sign marks carry forward only to the Anesthesia Stop time; until a
  // stop is entered they fill to the end of the grid.
  const endCol = (() => {
    const s = parseTime(d.tx.surgStart ?? '');
    const e = parseTime(d.tx.anesStop ?? '');
    if (s == null || e == null) return COLS - 1;
    let diff = e - s;
    if (diff < 0) diff += 24 * 60;
    return Math.max(0, Math.min(COLS - 1, Math.floor(diff / STEP)));
  })();

  // One tappable charting cell.
  const cell = (rowKey: string, col: number) => (
    <input
      {...noAuto}
      key={col}
      className="ar-cell"
      value={d.cells[`${rowKey}:${col}`] ?? ''}
      onChange={(e) => setCell(`${rowKey}:${col}`, e.target.value)}
    />
  );

  // Value row: label | tappable time-columns | totals input
  const crow = (label: ReactNode, key: string) => (
    <div className="ar-crow" key={key}>
      <div className="ar-clabel">{label}</div>
      <div className="ar-cells">{Array.from({ length: COLS }, (_, c) => cell(key, c))}</div>
      <input
        {...noAuto}
        className="ar-cell ar-totalcell"
        value={d.cells[`${key}:total`] ?? ''}
        onChange={(e) => setCell(`${key}:total`, e.target.value)}
      />
    </div>
  );

  // Vital-signs row: label | crosshatch for hand-drawn BP/HR ticks | totals
  const vrow = (n: number) => (
    <div className="ar-crow vs" key={`vs${n}`}>
      <div className="ar-clabel num">{n} &mdash;</div>
      <div className="ar-vscells">
        <svg className="ar-vsgrid" viewBox={`0 0 ${COLS * STEP} 10`} preserveAspectRatio="none" aria-hidden="true">
          {Array.from({ length: COLS * STEP + 1 }, (_, x) => {
            // faint 1-min, light 5-min, darker 15-min, darkest 30-min
            const stroke = x % 30 === 0 ? '#555' : x % 15 === 0 ? '#888' : x % 5 === 0 ? '#aaa' : '#e0e0e0';
            const w = x % 15 === 0 ? 0.6 : x % 5 === 0 ? 0.4 : 0.2;
            return <line key={x} x1={x} y1="0" x2={x} y2="10" stroke={stroke} strokeWidth={w} />;
          })}
          <line x1="0" y1="5" x2={COLS * STEP} y2="5" stroke="#ccc" strokeWidth="0.2" />
        </svg>
      </div>
      <div className="ar-ctotal" />
    </div>
  );

  // Band with a sideways label spanning its rows
  const band = (label: string, rows: ReactNode, cls = '') => (
    <div className={`ar-band ${cls}`}>
      <div className="ar-vband"><span>{label}</span></div>
      <div className="ar-bandrows">{rows}</div>
    </div>
  );

  if (mode === 'wizard') {
    return (
      <>
        <div className="awiz-switch screen-only">
          <button type="button" className="chip on" onClick={() => setMode('chart')}>← Back to full chart</button>
        </div>
        <AnesWizard
          ck={d.ck}
          tx={d.tx}
          cells={d.cells}
          setCk={(k, v) => setD((p) => ({ ...p, ck: { ...p.ck, [k]: v } }))}
          setTx={(k, v) => setD((p) => ({ ...p, tx: { ...p.tx, [k]: v } }))}
          setCell={setCell}
          endCol={endCol}
          onDone={() => setMode('chart')}
        />
      </>
    );
  }

  return (
    <div className="ar-wrap">
      <div className="awiz-switch screen-only">
        <button type="button" className="chip" onClick={() => setMode('wizard')}>⛑ Guided setup wizard</button>
        <span className="awiz-switch-hint">Walks you through setup, airway &amp; end-of-case. The grid stays tap-and-drag.</span>
        <span className="ar-zoomctl">
          <button type="button" className="chip" onClick={() => bumpZoom(-0.2)} aria-label="Zoom out">−</button>
          <button type="button" className="chip ar-zoomval" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="chip" onClick={() => bumpZoom(0.2)} aria-label="Zoom in">+</button>
        </span>
      </div>
      <div
        className="ar-scaler"
        style={zoom !== 1 && natural.w ? { width: natural.w * zoom, height: natural.h * zoom } : undefined}
      >
      <div
        className="ar"
        ref={arRef}
        style={zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: 'top left' } : undefined}
      >
        {/* Header: two rows, allergies + patient label boxes span both */}
        <div className="ar-header">
          <div className="ar-hleft">
            <div className="ar-hrow">
              <span className="cell w4">{ck('hp', 'H&P')}</span>
              <span className="cell w4"><span className="lbl">OR #</span>{tx('orNum', 'short')}</span>
              <span className="cell w4"><span className="lbl">DATE</span>{tx('date', 'med')}</span>
            </div>
            <div className="ar-hrow">
              <span className="cell w4">{ck('opPermit', 'OP Permit')}</span>
              <span className="cell w4">{ck('consent', 'Anesthesia Consent')}</span>
              <span className="cell w4">{ck('chartReviewed', 'Chart Reviewed')}</span>
            </div>
          </div>
          <div className="ar-hallergy">
            <span className="lbl">ALLERGIES</span>
            <input
              {...noAuto}
              className="t u wide"
              value={caseData.allergies}
              onChange={(e) => setCaseField('allergies', e.target.value)}
            />
          </div>
          <div className="ar-hlabel">Patient Label</div>
        </div>

        {/* Setup sections */}
        <div className="ar-sections">
          <div className="ar-sec ar-safety">
            <div className="ar-h">Safety</div>
            {ck('gasCheck', 'Gas Machine Check')}
            {ck('equipCheck', 'Equipment Check')}
            {ck('disconnect', 'Disconnect')}
            <div className="ar-h">Techniques</div>
            {ck('regional', 'Regional')}
            {ck('general', 'General')}
            {ck('mac', 'MAC')}
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
            {ck('lma', 'LMA')}
            <div className="ar-line">{ck('lmaSizeCk', 'Size')}{tx('lmaSize', 'xshort')}</div>
            <div className="ar-line">{ck('air', 'Air')}{tx('airMl', 'xshort')} <span>mL</span></div>
          </div>

          <div className="ar-sec">
            <div className="ar-h">Endotracheal</div>
            <div className="ar-line">{ck('ettOral', 'Oral')}{ck('ettNasal', 'Nasal')}{ck('ettRae', 'RAE')}</div>
            <div className="ar-line"><span>Tube size.</span>{tx('tubeSize', 'xshort')} <span>mm</span></div>
            <div className="ar-line"><span>Length</span>{tx('tubeLength', 'xshort')} <span>cm (Lip)</span></div>
            <div className="ar-line ind">{ck('lubricant', 'Lubricant')}{ck('trachSpray', 'Trach Spray')}</div>
            <div className="ar-line ind">{ck('rapidSequence', 'Rapid Sequence')}</div>
            <div className="ar-line ind">{ck('cricoid', 'Cricoid Pressure')}</div>
            <div className="ar-line"><span className="b">CUFF:</span>{ck('cuffNone', 'None')}{ck('cuffInflated', 'Inflated')}</div>
            <div className="ar-line ind">{ck('easy', 'Easy')}{ck('difficult', 'Difficult')}</div>
            <div className="ar-line ind">{ck('atraumatic', 'Atraumatic')}{ck('traumatic', 'Traumatic')}</div>
            <div className="ar-line"><span className="b">BREATH SOUNDS:</span></div>
            <div className="ar-line ind">{ck('bilateral', 'Bilateral')}{ck('equal', 'Equal')}</div>
            <div className="ar-line"><span className="b">TIME:</span>{tx('ettTime', 'short')}</div>
            <div className="ar-line">{ck('attemptsCk', '# Attempts')}{tx('attempts', 'xshort')}</div>
            {ck('arrivedIntubated', 'Arrived Intubated')}
            {ck('dentitionUnchanged', 'Dentition unchanged')}
          </div>

          <div className="ar-sec">
            <div className="ar-h">Monitors</div>
            <div className="ar-line"><span className="b">BP:</span>{ck('bpAuto', 'Auto')}{ck('bpManual', 'Manual')}{ck('bpL', 'L')}{ck('bpR', 'R')}</div>
            <div className="ar-line ind">{ck('bpArm', 'Arm')}{ck('bpLeg', 'Leg')}</div>
            <div className="ar-line"><span className="b">STETH:</span>{ck('stethE', 'E')}{ck('stethP', 'P')}{ck('doppler', 'Doppler')}</div>
            {ck('nerveStim', 'Nerve Stimulator')}
            {ck('pulseOx', 'Pulse Oximeter')}
            {ck('capnography', 'Capnography')}
            {ck('ecg', 'ECG')}
            <div className="ar-line">{ck('temp', 'Temp')}{ck('tempE', 'E')}{ck('tempSk', 'SK')}{ck('tempBlad', 'Blad')}{ck('tempR', 'R')}</div>
            <div className="ar-line">{ck('o2Analyzer', 'O₂ Analyzer')}{ck('calibrated', 'Calibrated')}</div>
            <div className="ar-line"><span className="b">WARMER:</span>{ck('warmerIv', 'IV Blood')}</div>
            <div className="ar-line ind">{ck('bairHugger', 'Bair Hugger')}{ck('bairUp', '↑')}{ck('bairDown', '↓')}</div>
            <div className="ar-line">{ck('hme', 'HME')} <span>Temp</span>{tx('hmeTemp', 'xshort')}</div>
            <div className="ar-line">{ck('artLine', 'Arterial Line')}{ck('artL', 'L')}{ck('artR', 'R')}</div>
            {ck('cvp', 'CVP')}
            {ck('swanGanz', 'Swan-Ganz')}
            <div className="ar-line">{ck('iv', 'IV')}{ck('ivL', 'L')}{ck('ivR', 'R')}</div>
          </div>

          <div className="ar-sec">
            <div className="ar-h">Positioning</div>
            <div className="ar-line"><span className="b">HEAD:</span>{ck('pillow', 'Pillow')}</div>
            <div className="ar-line ind2">{ck('gelDonut', 'Gel Donut')}</div>
            <div className="ar-line ind2">{ck('foam', 'Foam')}</div>
            <div className="ar-line"><span className="b">NECK:</span>{ck('alignment', 'Alignment')}</div>
            <div className="ar-line"><span className="b">EYES:</span></div>
            <div className="ar-line ind">{ck('os', 'OS')}{ck('od', 'OD')}{ck('ou', 'OU')}</div>
            <div className="ar-line ind">{ck('lacriLube', 'Lacri Lube')}</div>
            <div className="ar-line ind">{ck('eyeTape', 'Tape')}</div>
            <div className="ar-line"><span className="b">ARM:</span> <span>Tucked/padded</span></div>
            <div className="ar-line ind">{ck('armL', 'L')}{ck('armR', 'R')}</div>
            {ck('gelAxillaryRoll', 'Gel Axillary Roll')}
            {ck('ngOgTube', 'NG/OG Tube')}
            <div className="ar-line">{ck('patientId', 'Patient')} <span>Identification</span></div>
          </div>

          <div className="ar-sec ar-conduction">
            <div className="ar-h">Conduction Anesthesia</div>
            <div className="ar-cond3">
              <div className="ar-condcol">
                {ck('spinal', 'Spinal')}
                {ck('epidural', 'Epidural')}
                {ck('bier', 'Bier')}
                {ck('axillary', 'Axillary')}
                {ck('condOther', 'Other')}
                {ck('local', 'Local')}
              </div>
              <div className="ar-condcol mid">
                <div className="ar-line">{ck('duramorphCk', 'Duramorph')}{tx('duramorph', 'xshort')} <span>mg</span></div>
                <div className="ar-line">{ck('fentanylCk', 'Fentanyl')}{tx('fentanyl', 'xshort')} <span>mcg</span></div>
                <div className="ar-line">{ck('sufentaCk', 'Sufenta')}{tx('sufenta', 'xshort')} <span>mcg</span></div>
                <div className="ar-line">{ck('naropinCk', 'Naropin')}{tx('naropin', 'xshort')} <span>mL</span></div>
                <div className="ar-line">{ck('nesacaineCk', 'Nesacaine')}{tx('nesacaine', 'xshort')} <span>mL</span></div>
                <div className="ar-line">{ck('sensorcaineCk', 'Sensorcaine')}{tx('sensorcaine', 'xshort')} <span>mL</span></div>
                <div className="ar-line">{ck('xylocaineCk', 'Xylocaine')}{tx('xylocaine', 'xshort')} <span>mL</span></div>
                <div className="ar-line">{ck('condOther1Ck', 'Other')}{tx('condOther1', 'short')}</div>
                <div className="ar-line">{ck('condOther2Ck', 'Other')}{tx('condOther2', 'short')}</div>
              </div>
              <div className="ar-condcol">
                <div className="ar-line">{ck('needleSizeCk', 'Needle Size')}{tx('needleSize', 'xshort')}</div>
                <div className="ar-line">{ck('condAttemptsCk', '# Attempts')}{tx('condAttempts', 'xshort')}</div>
                <div className="ar-line">{ck('siteCk', 'Site')}{tx('site', 'short')}</div>
                {ck('paresthesia', 'Paresthesia')}
                {ck('cffcsf', 'CFFCSF')}
                <div className="ar-line">{ck('condTimeCk', 'Time')}{tx('condTime', 'short')}</div>
              </div>
            </div>
            <div className="ar-line"><span>Lot #</span>{tx('lotNum', 'grow')} <span>Expiration Date:</span>{tx('expDate', 'grow')}</div>
            <div className="ar-line"><span>Manufacturer</span>{tx('manufacturer', 'grow')}</div>
          </div>
        </div>

        {/* Charting band */}
        <div className="ar-main">
          <div className="ar-symcol">
            <div className="ar-h">Symbols</div>
            <div className="ar-sym"><span className="b">X</span><br />Anesthesia</div>
            <div className="ar-sym"><span className="b">&#8857;</span><br />Operator</div>
            <div className="ar-sym"><span className="b">&#7515;</span><br />BP Cuff<br />Pressure</div>
            <div className="ar-sym"><span className="b">&#8869;<br />&#8868;</span><br />Arterial Line<br />Pressure</div>
            <div className="ar-sym"><span className="b">&#9650;</span><br />Mean<br />Arterial<br />Pressure</div>
            <div className="ar-sym"><span className="b">&#9679;</span><br />Pulse</div>
            <div className="ar-sym"><span className="b">O/S</span><br />Spont<br />Resp</div>
            <div className="ar-sym"><span className="b">&Oslash;/A</span><br />Assisted<br />Resp</div>
            <div className="ar-sym"><span className="b">&#8855;/C</span><br />Controlled<br />Resp</div>
            <div className="ar-sym"><span className="b">T</span><br />Tourniquet</div>
            <div className="ar-ivblock">
              <div className="ar-line"><span>IV Star</span>{tx('ivStar', 'grow')}</div>
              <div className="ar-line"><span>Size</span>{tx('ivSize', 'grow')}</div>
              <div className="ar-line"><span>Area</span>{tx('ivArea', 'grow')}</div>
              <div className="ar-line"><span>Local</span>{tx('ivLocal', 'grow')}</div>
            </div>
          </div>

          <div className="ar-chart">
            {/* Time axis: surgery start anchors 5-minute columns */}
            <div className="ar-band ar-timeband">
              <div className="ar-vband" />
              <div className="ar-bandrows">
                <div className="ar-crow th">
                  <div className="ar-clabel th-start">
                    <span>Surgery start</span>
                    <input
                      {...noAuto}
                      className="ar-startinput"
                      placeholder="0730"
                      value={d.tx.surgStart ?? ''}
                      onChange={(e) => setD((p) => ({ ...p, tx: { ...p.tx, surgStart: e.target.value } }))}
                    />
                  </div>
                  <div className="ar-cells th-times">
                    {times.map((t, c) => (
                      <div className="ar-thcell" key={c}>{c % 2 === 0 ? t : ''}</div>
                    ))}
                  </div>
                  <div className="ar-ctotal th-total">Totals</div>
                </div>
              </div>
            </div>
            {band('Medications', (
              <>
                {crow('Oxygen (L/minute)', 'med0')}
                {crow(<span className="ar-inlineck">{ck('n2o', 'N₂O')}{ck('airMed', 'Air')} (L/minute)</span>, 'med1')}
                {crow('ISO/SEVO/ET%', 'med2')}
                {crow('PROPOFOL IV mg', 'med3')}
                {crow('ANECTINE IV mg', 'med4')}
                {crow('VEC/ROC IV mg', 'med5')}
                {crow('SUFENTA/SUBLIMAZE IV mcg', 'med6')}
                {crow('VERSED IV mg', 'med7')}
                {crow('REGLAN/ZOFRAN IV mg', 'med8')}
              </>
            ))}
            {band('Other', (
              <>
                {crow('TORADOL IV mg', 'oth0')}
                {crow('ROBINUL IV mg', 'oth1')}
                {crow('NEO IV mg', 'oth2')}
                {crow('SUGAMMADEX IV mg', 'oth3')}
                {crow('LIDOCAINE IV mg', 'oth5')}
                {crow('ANCEF (cefazolin) g', 'oth6')}
                {crow('LR/D5LR/NS', 'oth4')}
              </>
            ))}
            <div className="ar-band vsband">
              <div className="ar-vband"><span>Vital Signs</span></div>
              <div className="ar-bandrows vsrows">
                <div className="vg-first screen-only">
                  <span className="vg-first-title">First reading:</span>
                  {firstReading('sys', 'Sys ⌄')}
                  {firstReading('dia', 'Dia ⌃')}
                  {firstReading('hr', 'HR ●')}
                  <span className="vg-first-hint">then drag each mark to the real value</span>
                </div>
                <div className="vsplot">
                  {[200, 180, 160, 140, 120, 100, 80, 60, 40, 20, 0].map((n) => vrow(n))}
                  <VitalsGraph cols={COLS} endCol={endCol} vitals={d.vitals} setVitals={setVitals} />
                </div>
                {/* Time axis at the graph: clock labels every 15 minutes */}
                <div className="vg-timeaxis">
                  <div className="vg-ta-spacer">Time</div>
                  <div className="vg-ta-cells">
                    {times.map((t, c) => (
                      <div className="vg-ta-cell" key={c}>{c % 3 === 0 ? t : ''}</div>
                    ))}
                  </div>
                  <div className="vg-ta-total" />
                </div>
              </div>
            </div>
            {band('Vent', (
              <>
                {crow('Rate', 'vent0')}
                {crow('Volume', 'vent1')}
                {crow('FiO₂', 'vent2')}
                {crow('Inspiratory Pressure', 'vent3')}
              </>
            ))}
            {band('Monitors', (
              <>
                {crow('EtCO₂', 'mon0')}
                {crow('SaO₂', 'mon1')}
                {crow('Temp', 'mon2')}
                {crow('EKG', 'mon3')}
                {crow('Urine', 'mon4')}
                {crow('EBL', 'mon5')}
                {crow('POS', 'mon6')}
                {crow('TO₄', 'mon7')}
              </>
            ))}
            <div className="ar-band">
              <div className="ar-vband" />
              <div className="ar-bandrows">
                {crow('Symbols for Remarks', 'symrem')}
              </div>
            </div>
          </div>

          <div className="ar-right">
            <div className="ar-rbox ar-remarksbox">
              <div className="ar-h">Remarks</div>
              <div className="ar-line"><span className="b">TIME:</span>{tx('remarkTime', 'grow')}</div>
              {ck('preInduction', 'Pre-induction anesthestic reassessment')}
              <textarea
                {...noAuto}
                className="a ar-remarks"
                rows={9}
                value={d.tx.remarks ?? ''}
                onChange={(e) => setD((p) => ({ ...p, tx: { ...p.tx, remarks: e.target.value } }))}
              />
            </div>
            <div className="ar-rbox">
              <div className="ar-h">Fluid Totals</div>
              <div className="ar-line"><span>Crystalloid</span>{tx('crystalloid', 'grow')}</div>
              <div className="ar-line"><span>EBL</span>{tx('fluidEbl', 'grow')}</div>
              <div className="ar-line"><span>Urine</span>{tx('fluidUrine', 'grow')}</div>
              <div className="ar-line"><span>Blood</span>{tx('fluidBlood', 'grow')}</div>
            </div>
            <div className="ar-rbox">
              <div className="ar-h">Recovery</div>
              <div className="ar-line"><span>Location</span>{tx('recLocation', 'grow')}</div>
              <div className="ar-line"><span>Time</span>{tx('recTime', 'grow')}</div>
              <div className="ar-line"><span>BP</span>{tx('recBp', 'grow')}</div>
              <div className="ar-line"><span>O&#8322; Sat</span>{tx('recO2', 'grow')}</div>
              <div className="ar-line"><span>P</span>{tx('recP', 'grow')}</div>
              <div className="ar-line"><span>R</span>{tx('recR', 'grow')}</div>
              <div className="ar-line"><span>T</span>{tx('recT', 'grow')}</div>
              {ck('recDentition', 'Dentition unchanged')}
              {ck('reportToRn', 'Report to RN')}
              <div className="ar-line">{ck('awake', 'Awake')}{ck('stable', 'Stable')}{ck('recNasalO2', 'Nasal Oxygen')}</div>
              <div className="ar-line">{ck('drowsy', 'Drowsy')}{ck('unstable', 'Unstable')}{ck('maskO2', 'Mask Oxygen')}</div>
              <div className="ar-line">{ck('somnolent', 'Somnolent')}{ck('recIntubated', 'Intubated')}</div>
              <div className="ar-line">{ck('tPiece', 'T-piece Oxygen')}{ck('unarousable', 'Unarousable')}</div>
              <div className="ar-line">{ck('recVentilator', 'Ventilator')}{ck('oralNasalAirway', 'Oral/Nasal Airway')}</div>
            </div>
          </div>
        </div>

        {/* Bottom admin block */}
        <div className="ar-bottom">
          <div className="ar-bleft">
            <div className="ar-surgeon">
              <span className="lbl">Surgeon(s)</span>
              {tx('surgeons', 'wide')}
            </div>
            <div className="ar-asa">
              <span className="lbl">ASA</span>
              {ck('asa1', '1')}{ck('asa2', '2')}{ck('asa3', '3')}{ck('asa4', '4')}{ck('asa5', '5')}{ck('asaE', 'E')}
            </div>
          </div>
          <div className="ar-bright">
            <div className="ar-brow"><span className="lbl">Anesthetist</span>{tx('anesthetist', 'wide')}</div>
            <div className="ar-brow"><span className="lbl">Procedure</span>{tx('procedure', 'wide')}</div>
            <div className="ar-btable">
              <div className="ar-times">
                <div className="ar-trow head"><span /><span>Start</span><span>Stop</span></div>
                <div className="ar-trow"><span className="lbl">Anesthesia</span>{tx('anesStart', 'cellu')}{tx('anesStop', 'cellu')}</div>
                <div className="ar-trow"><span className="lbl">Surgery</span>{tx('surgStart', 'cellu')}{tx('surgStop', 'cellu')}</div>
              </div>
              <div className="ar-dx">
                <span className="lbl">Diagnosis</span>
                {tx('diagnosis', 'wide')}
              </div>
            </div>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}

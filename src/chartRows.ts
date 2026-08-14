// Shared definitions for the charting grid rows, used by both the grid itself
// and the column pass, so the two can never drift apart.

// Continuously-running values: entered once, they hold until changed, the way
// they are charted on paper. Boluses (drugs) and cumulative figures (urine,
// EBL) are deliberately excluded.
export const CARRY_ROWS = new Set([
  'med0', // Oxygen L/min
  'med1', // N2O / Air L/min
  'med2', // ISO/SEVO ET%
  'vent0', 'vent1', 'vent2', 'vent3', // Rate, Volume, FiO2, Insp pressure
  'mon0', 'mon1', 'mon2', 'mon3', 'mon6', 'mon7', // EtCO2, SaO2, Temp, EKG, POS, TO4
]);

export interface StepSpec {
  min: number;
  max: number;
  inc: number;
  label: string;
  unit: string;
  start: number;
}

// Slider ranges for the continuously-running rows, so tapping a cell offers a
// nudge/sweep instead of retyping. Values outside a range can still be typed
// on the 10-key.
export const STEP_SPECS: Record<string, StepSpec> = {
  med0: { min: 0, max: 10, inc: 0.5, label: 'Oxygen', unit: 'L/min', start: 2 },
  med1: { min: 0, max: 10, inc: 0.5, label: 'N₂O / Air', unit: 'L/min', start: 2 },
  med2: { min: 0, max: 8, inc: 0.1, label: 'ISO / SEVO', unit: 'ET%', start: 1.5 },
  vent0: { min: 4, max: 30, inc: 1, label: 'Rate', unit: '/min', start: 12 },
  vent1: { min: 200, max: 900, inc: 10, label: 'Tidal volume', unit: 'mL', start: 500 },
  vent2: { min: 0.21, max: 1, inc: 0.05, label: 'FiO₂', unit: '', start: 0.5 },
  vent3: { min: 5, max: 40, inc: 1, label: 'Insp. pressure', unit: 'cm H₂O', start: 18 },
  mon0: { min: 15, max: 65, inc: 1, label: 'EtCO₂', unit: 'mmHg', start: 35 },
  mon1: { min: 70, max: 100, inc: 1, label: 'SaO₂', unit: '%', start: 99 },
  mon7: { min: 0, max: 4, inc: 1, label: 'TO₄', unit: 'twitches', start: 4 },
};

// A row in the column pass. Order matches the printed chart, top to bottom,
// because that is the order the column is filled in on paper.
export interface PassRow {
  key: string; // grid row key, or 'sys' | 'dia' | 'hr' for the vitals overlay
  label: string;
  kind: 'vital' | 'slider' | 'temp' | 'chips' | 'free';
  unit?: string;
  options?: string[]; // for 'chips'
  spec?: StepSpec; // for 'vital'
  // Rows whose printed label is a pair of boxes — one gas or the other, never
  // both. Picking one ticks its box on the record and unticks the other.
  exclusiveCk?: Array<{ ck: string; label: string }>;
}

// The rounds pass: what gets looked at every five minutes.
export const PASS_ROWS: PassRow[] = [
  { key: 'sys', label: 'Systolic', kind: 'vital', unit: 'mmHg', spec: { min: 40, max: 200, inc: 2, label: 'Systolic', unit: 'mmHg', start: 120 } },
  { key: 'dia', label: 'Diastolic', kind: 'vital', unit: 'mmHg', spec: { min: 20, max: 140, inc: 2, label: 'Diastolic', unit: 'mmHg', start: 70 } },
  { key: 'hr', label: 'Heart rate', kind: 'vital', unit: 'bpm', spec: { min: 20, max: 180, inc: 1, label: 'Heart rate', unit: 'bpm', start: 70 } },
  { key: 'med0', label: 'Oxygen', kind: 'slider', unit: 'L/min' },
  {
    key: 'med1',
    label: 'N₂O / Air',
    kind: 'slider',
    unit: 'L/min',
    exclusiveCk: [
      { ck: 'n2o', label: 'N₂O' },
      { ck: 'airMed', label: 'Air' },
    ],
  },
  { key: 'med2', label: 'ISO / SEVO', kind: 'slider', unit: 'ET%' },
  { key: 'vmode', label: 'Vent mode', kind: 'chips', options: ['VC', 'PC', 'SIMV', 'PS', 'SV'] },
  { key: 'vent0', label: 'Rate', kind: 'slider', unit: '/min' },
  { key: 'vent1', label: 'Tidal volume', kind: 'slider', unit: 'mL' },
  { key: 'vent2', label: 'FiO₂', kind: 'slider' },
  { key: 'vent3', label: 'Insp. pressure', kind: 'slider', unit: 'cm H₂O' },
  { key: 'mon0', label: 'EtCO₂', kind: 'slider', unit: 'mmHg' },
  { key: 'mon1', label: 'SaO₂', kind: 'slider', unit: '%' },
  { key: 'mon2', label: 'Temp', kind: 'temp', unit: '°' },
  { key: 'mon3', label: 'EKG', kind: 'chips', options: ['NSR', 'ST', 'SB', 'AF', 'PVC'] },
  { key: 'mon6', label: 'Position', kind: 'chips', options: ['Sup', 'Pron', 'Lat', 'Bch', 'Lith'] },
  { key: 'mon7', label: 'TO₄', kind: 'slider', unit: 'twitches' },
];

// Given only when they are given: kept out of the every-round list so the
// pass stays short, but one tap away underneath it.
export const AS_NEEDED_ROWS: PassRow[] = [
  { key: 'mon4', label: 'Urine', kind: 'free', unit: 'mL' },
  { key: 'mon5', label: 'EBL', kind: 'free', unit: 'mL' },
  { key: 'oth4', label: 'LR / D5LR / NS', kind: 'free', unit: 'mL' },
  { key: 'med3', label: 'Propofol', kind: 'free', unit: 'mg' },
  { key: 'med4', label: 'Anectine', kind: 'free', unit: 'mg' },
  { key: 'med5', label: 'Vec / Roc', kind: 'free', unit: 'mg' },
  { key: 'med6', label: 'Sufenta / Sublimaze', kind: 'free', unit: 'mcg' },
  { key: 'med7', label: 'Versed', kind: 'free', unit: 'mg' },
  { key: 'med8', label: 'Reglan / Zofran', kind: 'free', unit: 'mg' },
  { key: 'oth0', label: 'Toradol', kind: 'free', unit: 'mg' },
  { key: 'oth1', label: 'Robinul', kind: 'free', unit: 'mg' },
  { key: 'oth2', label: 'Neo', kind: 'free', unit: 'mg' },
  { key: 'oth3', label: 'Sugammadex', kind: 'free', unit: 'mg' },
  { key: 'oth5', label: 'Lidocaine', kind: 'free', unit: 'mg' },
  { key: 'oth6', label: 'Ancef', kind: 'free', unit: 'g' },
];

// Value carried into a column from the last entry at or before it. An
// explicitly blanked cell stops the carry, so turning something off works.
export function carriedInto(cells: Record<string, string>, rowKey: string, col: number): string {
  let v = '';
  for (let c = 0; c < col; c++) {
    const e = cells[`${rowKey}:${c}`];
    if (e !== undefined) v = e;
  }
  return v;
}

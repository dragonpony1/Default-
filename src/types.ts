export type YesNo = '' | 'yes' | 'no';

export interface MedEntry {
  name: string;
  dose: string;
  lastDose: string;
}

export interface AllergyEntry {
  name: string;
  reaction: string;
}

export interface PrevHxEntry {
  name: string;
  detail: string;
}

export interface PreopEval {
  // Header
  age: string;
  sex: '' | 'M' | 'F';
  height: string;
  heightUnit: '' | 'in' | 'cm';
  weight: string;
  weightUnit: '' | 'lb' | 'kg';
  proposedProcedure: string;
  bp: string;
  p: string;
  r: string;
  t: string;
  prevHxList: PrevHxEntry[];
  previousAnesthesia: string;
  previousAnesthesiaNone: boolean;
  meds: MedEntry[];
  currentMedications: string;
  currentMedicationsNone: boolean;
  familyHistory: string;
  familyHistoryNone: boolean;
  allergyList: AllergyEntry[];
  allergies: string;
  allergiesNone: boolean;

  // Airway / Teeth / Head and Neck
  mallampati: string;
  npo: string;
  tmd: string;
  rom: string;

  // History From
  hfPatient: boolean;
  hfParentGuardian: boolean;
  hfSignificantOther: boolean;
  hfChart: boolean;
  hfCommLanguage: boolean;
  hfPoorHistorian: boolean;

  // Systems review
  wnl: Record<string, boolean>;
  checks: Record<string, boolean>;
  checkDetails: Record<string, string>;
  customConditions: Record<string, string[]>;
  comments: Record<string, string>;
  tobacco: YesNo;
  tobaccoPacksDay: string;
  tobaccoYears: string;
  homeO2: '' | 'night' | '24/7';
  homeO2Liters: string;
  ethanol: YesNo;
  ethanolFreq: string;
  streetDrug: YesNo;
  streetDrugFreq: string;

  // Diagnostics studies
  dxNone: boolean;
  dxEkg: string;
  dxCxr: string;
  dxPulm: string;
  dxOther: string;

  // Laboratory studies
  labHgb: string;
  labElectrolytes: string;
  labUrinalysis: string;
  labOther: string;

  // Post-anesthesia note
  panBp: string;
  panP: string;
  panR: string;
  panT: string;
  panO2: string;
  panPain: string;
  panNV: string;
  panAirway: string;
  panMental: string;
  panHydration: string;
  panHydrationVol: string;
  panNotes: string;
  panDateTime: string;

  // Bottom-left
  problemList: string;
  plannedAnesthesia: string;
  physicalStatus: '' | '1' | '2' | '3' | '4' | '5';
  physicalStatusE: boolean;
  preAnesthesiaMeds: string;
  evalDateTime: string;

  // Inpatient note post-anesthesia
  inpBp: string;
  inpP: string;
  inpR: string;
  inpT: string;
  inpO2: string;
  inpPain: string;
  inpNV: string;
  inpAirway: string;
  inpMental: string;
  inpNotes: string;
  inpDateTime: string;
}

export const emptyPreopEval: PreopEval = {
  age: '',
  sex: '',
  height: '',
  heightUnit: '',
  weight: '',
  weightUnit: '',
  proposedProcedure: '',
  bp: '',
  p: '',
  r: '',
  t: '',
  prevHxList: [],
  previousAnesthesia: '',
  previousAnesthesiaNone: false,
  meds: [],
  currentMedications: '',
  currentMedicationsNone: false,
  familyHistory: '',
  familyHistoryNone: false,
  allergyList: [],
  allergies: '',
  allergiesNone: false,
  mallampati: '',
  npo: '',
  tmd: '',
  rom: '',
  hfPatient: false,
  hfParentGuardian: false,
  hfSignificantOther: false,
  hfChart: false,
  hfCommLanguage: false,
  hfPoorHistorian: false,
  wnl: {},
  checks: {},
  checkDetails: {},
  customConditions: {},
  comments: {},
  tobacco: '',
  tobaccoPacksDay: '',
  tobaccoYears: '',
  homeO2: '',
  homeO2Liters: '',
  ethanol: '',
  ethanolFreq: '',
  streetDrug: '',
  streetDrugFreq: '',
  dxNone: false,
  dxEkg: '',
  dxCxr: '',
  dxPulm: '',
  dxOther: '',
  labHgb: '',
  labElectrolytes: '',
  labUrinalysis: '',
  labOther: '',
  panBp: '',
  panP: '',
  panR: '',
  panT: '',
  panO2: '',
  panPain: '',
  panNV: '',
  panAirway: '',
  panMental: '',
  panHydration: '',
  panHydrationVol: '',
  panNotes: '',
  panDateTime: '',
  problemList: '',
  plannedAnesthesia: '',
  physicalStatus: '',
  physicalStatusE: false,
  preAnesthesiaMeds: '',
  evalDateTime: '',
  inpBp: '',
  inpP: '',
  inpR: '',
  inpT: '',
  inpO2: '',
  inpPain: '',
  inpNV: '',
  inpAirway: '',
  inpMental: '',
  inpNotes: '',
  inpDateTime: '',
};

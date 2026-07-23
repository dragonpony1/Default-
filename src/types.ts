export interface PreopEval {
  // Patient identification
  patientName: string;
  mrn: string;
  dob: string;
  age: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  date: string;

  // Procedure
  procedure: string;
  surgeon: string;
  diagnosis: string;

  // History
  allergies: string;
  medications: string;
  pastMedicalHistory: string;
  pastSurgicalHistory: string;
  anesthesiaHistory: string;
  familyAnesthesiaHistory: string;
  npoStatus: string;

  // Review of systems
  cardiac: string;
  pulmonary: string;
  renal: string;
  hepaticGI: string;
  neuro: string;
  endocrine: string;
  other: string;

  // Airway exam
  mallampati: string;
  thyromentalDistance: string;
  mouthOpening: string;
  neckROM: string;
  dentition: string;
  airwayNotes: string;

  // Physical exam
  bp: string;
  hr: string;
  rr: string;
  spo2: string;
  temp: string;
  heartExam: string;
  lungExam: string;

  // Labs / studies
  labs: string;
  ekg: string;
  imaging: string;

  // Assessment
  asaClass: string;
  asaEmergency: boolean;
  anestheticPlan: string;
  assessmentNotes: string;

  // Sign-off
  providerName: string;
  evalDateTime: string;
}

export const emptyPreopEval: PreopEval = {
  patientName: '',
  mrn: '',
  dob: '',
  age: '',
  sex: '',
  heightCm: '',
  weightKg: '',
  date: '',
  procedure: '',
  surgeon: '',
  diagnosis: '',
  allergies: '',
  medications: '',
  pastMedicalHistory: '',
  pastSurgicalHistory: '',
  anesthesiaHistory: '',
  familyAnesthesiaHistory: '',
  npoStatus: '',
  cardiac: '',
  pulmonary: '',
  renal: '',
  hepaticGI: '',
  neuro: '',
  endocrine: '',
  other: '',
  mallampati: '',
  thyromentalDistance: '',
  mouthOpening: '',
  neckROM: '',
  dentition: '',
  airwayNotes: '',
  bp: '',
  hr: '',
  rr: '',
  spo2: '',
  temp: '',
  heartExam: '',
  lungExam: '',
  labs: '',
  ekg: '',
  imaging: '',
  asaClass: '',
  asaEmergency: false,
  anestheticPlan: '',
  assessmentNotes: '',
  providerName: '',
  evalDateTime: '',
};

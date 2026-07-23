// Systems-review bands, matching Mountain West Medical Center form 170-165-90061.
// Column split mirrors the paper form exactly.

export interface SystemBand {
  key: string;
  title: string;
  col1: string[];
  col2?: string[];
}

export const SYSTEMS: SystemBand[] = [
  {
    key: 'resp',
    title: 'Respiratory',
    col1: ['Asthma', 'Bronchitis', 'COPD', 'Dyspnea', 'Orthopnea', 'Pneumonia'],
    col2: ['Productive Cough', 'Recent URI', 'SOB', 'Tuberculosis', 'OSA/CPAP'],
  },
  {
    key: 'cardio',
    title: 'Cardiovascular',
    col1: ['Abnormal EKG', 'Angina', 'ASHD', 'Dysrhythmia', 'Edema', 'Exercise Tolerance'],
    col2: ['Hypertension', 'MI', 'Murmur', 'Pacemaker', 'Rheumatic Fever', 'Vascular Disease'],
  },
  {
    key: 'gi',
    title: 'Hepato / Gastrointestinal',
    col1: [
      'Bowel Obstruction',
      'Cirrhosis',
      'Hepatitis / Jaundice',
      'Hiatal Hernia/Reflux',
      'Nausea and Vomiting',
      'Ulcers',
    ],
  },
  {
    key: 'neuro',
    title: 'Neuro / Musculoskeletal',
    col1: ['Arthritis', 'Back Problems', 'CVA/Stroke/TIAs', 'DJD', 'Headaches / ICP', 'Loss of Consciousness'],
    col2: ['Muscle Weakness', 'Neuromuscular Dis.', 'Paralysis', 'Paresthesia', 'Syncope', 'Seizures'],
  },
  {
    key: 'renal',
    title: 'Renal / Endocrine',
    col1: [
      'Diabetes',
      'Renal Failure / Dialysis',
      'Thyroid Disease',
      'Urinary Retention',
      'Urinary Tract Infection',
      'Weight Loss /Gain',
    ],
  },
  {
    key: 'other',
    title: 'Other',
    col1: ['Anemia', 'Bleeding Tendencies', 'Cancer', 'Chemotherapy', 'Dehydration', 'Hemophilia'],
    col2: ['Immunosuppressed', 'Loss of Hearing', 'Loss of Vision', 'Recent Steroids', 'Transfusion History'],
  },
];

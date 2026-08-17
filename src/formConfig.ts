// Systems-review bands, matching Mountain West Medical Center form 170-165-90061.
// Column split mirrors the paper form exactly.

export interface SystemBand {
  key: string;
  title: string;
  col1: string[];
  col2?: string[];
}

// On-screen entry splits the paper form's combined "OSA/CPAP" box into
// separate OSA and CPAP choices; the printed checkbox stays combined, and
// checking either one checks it.
export function screenItems(s: SystemBand): string[] {
  return s.col1.concat(s.col2 ?? []).flatMap((l) => (l === 'OSA/CPAP' ? ['OSA', 'CPAP'] : [l]));
}

// Every condition selected in the systems review (built-in, custom-choice,
// and per-patient custom entries), in band order — feeds the Problem List.
// The detail typed under a checked condition ("Arthritis — osteoarthritis")
// rides along, so the problem list carries the actual diagnosis and not just
// the checkbox's word.
export function selectedProblems(
  checks: Record<string, boolean>,
  customConditions: Record<string, string[]>,
  details: Record<string, string> = {},
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (label: string, key?: string) => {
    const detail = key ? (details[key] ?? '').trim() : '';
    const full = detail ? `${label} — ${detail}` : label;
    if (full && !seen.has(full)) {
      seen.add(full);
      out.push(full);
    }
  };
  for (const s of SYSTEMS) {
    for (const [k, v] of Object.entries(checks)) {
      if (v && k.startsWith(`${s.key}:`)) push(k.slice(s.key.length + 1), k);
    }
    for (const label of customConditions[s.key] ?? []) push(label, `${s.key}:${label}`);
  }
  // Anything checked under a band not in SYSTEMS (future-proofing)
  for (const [k, v] of Object.entries(checks)) {
    if (v && k.includes(':')) push(k.slice(k.indexOf(':') + 1), k);
  }
  return out;
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

// A system is Within Normal Limits until something in its box says otherwise.
// Ticking any condition (built-in or custom) takes the system off WNL; with
// nothing ticked, WNL holds unless it was explicitly tapped off. The stored
// flag only records an explicit choice — absence means the default.
export function effectiveWnl(
  d: { wnl: Record<string, boolean>; checks: Record<string, boolean>; customConditions: Record<string, string[]> },
  key: string,
): boolean {
  const anyChecked =
    Object.entries(d.checks).some(([k, v]) => v && k.startsWith(`${key}:`)) ||
    (d.customConditions[key] ?? []).length > 0;
  if (anyChecked) return false;
  return d.wnl[key] ?? true;
}

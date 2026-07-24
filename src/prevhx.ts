// Offline dictionary for previous anesthesia events and common prior
// surgeries. Flags mark history that changes the anesthetic plan: red for
// airway/MH-level alerts, amber for PONV-type planning notes.

export interface PrevFlag {
  label: string;
  level: 'red' | 'amber';
}

export interface PrevInfo {
  name: string;
  aliases: string[];
  flag?: PrevFlag;
}

const h = (name: string, aliases: string[] = [], flag?: PrevFlag): PrevInfo => ({
  name,
  aliases,
  flag,
});

export const PREVHX_DICTIONARY: PrevInfo[] = [
  // Anesthesia history
  h('General anesthesia — no problems', ['GA']),
  h('Spinal / epidural — no problems', []),
  h('MAC / sedation — no problems', []),
  h('Difficult intubation / difficult airway', ['difficult airway'], { label: 'Airway', level: 'red' }),
  h('Malignant hyperthermia', ['MH'], { label: 'MH', level: 'red' }),
  h('Post-op intubation / ICU', [], { label: 'Airway', level: 'red' }),
  h('PONV after anesthesia', ['nausea after anesthesia'], { label: 'PONV', level: 'amber' }),
  h('Awareness under anesthesia', [], { label: 'Awareness', level: 'amber' }),
  h('Prolonged emergence', [], { label: 'Emergence', level: 'amber' }),
  h('Pseudocholinesterase deficiency', ['prolonged paralysis'], { label: 'Paralysis', level: 'red' }),
  // Common prior surgeries
  h('Appendectomy', ['appy']),
  h('Cholecystectomy', ['gallbladder', 'lap chole']),
  h('C-section', ['cesarean']),
  h('Hysterectomy', []),
  h('TKA', ['total knee']),
  h('THA', ['total hip']),
  h('Shoulder surgery', ['rotator cuff']),
  h('Spine surgery / fusion', ['back surgery', 'laminectomy']),
  h('CABG / open heart', ['bypass', 'open heart'], { label: 'Cardiac', level: 'amber' }),
  h('Cardiac stent / cath', ['PCI', 'stents'], { label: 'Cardiac', level: 'amber' }),
  h('Pacemaker / ICD placement', [], { label: 'Cardiac', level: 'amber' }),
  h('Gastric bypass / sleeve', ['bariatric'], { label: 'Aspiration', level: 'amber' }),
  h('Tonsillectomy', ['T&A']),
  h('Hernia repair', []),
  h('Cataract surgery', []),
  h('Colonoscopy', []),
  h('EGD', []),
  h('Thyroidectomy', []),
  h('Mastectomy', []),
  h('Prostatectomy', []),
  h('TURP', []),
  h('Carpal tunnel release', ['CTR']),
  h('ORIF (fracture repair)', ['ORIF']),
  h('Craniotomy', [], { label: 'Neuro', level: 'amber' }),
];

export function prevFlag(name: string): PrevFlag | undefined {
  const n = name.trim().toLowerCase();
  return PREVHX_DICTIONARY.find(
    (x) => x.name.toLowerCase() === n || x.aliases.some((al) => al.toLowerCase() === n),
  )?.flag;
}

export function searchPrevHx(query: string, extra: string[] = [], limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = (s: string) =>
    s.toLowerCase().split(/[\s\-/()&]+/).some((w) => w.startsWith(q));
  const out: string[] = [];
  const push = (label: string) => {
    if (!out.includes(label) && out.length < limit) out.push(label);
  };
  for (const name of extra) if (starts(name)) push(name);
  for (const x of PREVHX_DICTIONARY) {
    if (starts(x.name)) push(x.name);
    for (const al of x.aliases) {
      if (starts(al)) push(x.name);
    }
  }
  return out;
}

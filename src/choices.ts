// User-added options for the systems-review choice lists. Stored separately
// from the patient draft so they survive "Clear form" — they are part of how
// this device's form is configured, not patient data.
const KEY = 'preop-custom-choices-v1';

export type CustomChoices = Record<string, string[]>;

// Procedures are grouped by surgical service, each stored under proc:<service>.
export const SERVICES = ['Ortho', 'General', 'ENT', 'Podiatry', 'GYN'] as const;
export type Service = (typeof SERVICES)[number];
export const procKey = (svc: string) => `proc:${svc}`;

const DEFAULT_PROCS: Partial<Record<Service, string[]>> = {
  Ortho: [
    'TKA',
    'THA',
    'Shoulder scope',
    'TSA',
    'Trigger finger',
    'CTR',
    'Hip scope',
    'Knee arthroscopy',
  ],
  General: [
    'Colonoscopy',
    'EGD',
    'EGD + Colonoscopy',
    'Cholecystectomy',
    'Appendectomy',
    'Dx laparotomy',
    'Exploratory laparotomy',
    'TIF',
  ],
  ENT: ['Tonsils and adenoids', 'Septoplasty', 'Sinus scope', 'Nasal bone reduction'],
  Podiatry: ['Bone procedure', 'Soft tissue procedure'],
  GYN: ['Lap hyst', 'Vaginal hyst', 'Hysteroscopy', 'Suction D&C'],
};

// Each SEED_VERSION merges DEFAULT_PROCS into the stored lists exactly once
// per device, so later removals stick while new defaults still arrive.
const SEED_VERSION = 'v2';

function seed(c: CustomChoices): CustomChoices {
  let changed = false;
  for (const svc of SERVICES) {
    if (!(procKey(svc) in c)) {
      c[procKey(svc)] = [];
      changed = true;
    }
  }
  if ('procedure' in c) {
    c[procKey('General')] = [...new Set([...c[procKey('General')], ...c.procedure])];
    delete c.procedure;
    changed = true;
  }
  const done = c.__seeded ?? [];
  if (!done.includes(SEED_VERSION)) {
    for (const svc of SERVICES) {
      c[procKey(svc)] = [...new Set([...c[procKey(svc)], ...(DEFAULT_PROCS[svc] ?? [])])];
    }
    c.__seeded = [...done, SEED_VERSION];
    changed = true;
  }
  if (changed) saveCustomChoices(c);
  return c;
}

export function loadCustomChoices(): CustomChoices {
  try {
    const raw = localStorage.getItem(KEY);
    return seed(raw ? (JSON.parse(raw) as CustomChoices) : {});
  } catch {
    return seed({});
  }
}

export function saveCustomChoices(choices: CustomChoices): void {
  localStorage.setItem(KEY, JSON.stringify(choices));
}

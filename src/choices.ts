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
};

// Seed each service's default list once (only when the key has never been
// stored, so deletions stick), and fold any pre-services flat procedure list
// into General.
function seed(c: CustomChoices): CustomChoices {
  let changed = false;
  for (const svc of SERVICES) {
    if (!(procKey(svc) in c)) {
      c[procKey(svc)] = [...(DEFAULT_PROCS[svc] ?? [])];
      changed = true;
    }
  }
  if ('procedure' in c) {
    c[procKey('General')] = [...new Set([...c[procKey('General')], ...c.procedure])];
    delete c.procedure;
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

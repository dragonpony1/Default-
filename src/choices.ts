// User-added options for the systems-review choice lists. Stored separately
// from the patient draft so they survive "Clear form" — they are part of how
// this device's form is configured, not patient data.
const KEY = 'preop-custom-choices-v1';

export type CustomChoices = Record<string, string[]>;

// Procedures are grouped by surgical service, each stored under proc:<service>.
export const SERVICES = ['Ortho', 'General', 'ENT', 'Podiatry', 'GYN'] as const;
export type Service = (typeof SERVICES)[number];
export const procKey = (svc: string) => `proc:${svc}`;

// Versioned seeds: each version's payload merges into the stored lists
// exactly once per device, so later removals stick while new defaults still
// arrive in later versions.
const SEEDS: Array<[string, Record<string, string[]>]> = [
  [
    'v2',
    {
      [procKey('Ortho')]: [
        'TKA',
        'THA',
        'Shoulder scope',
        'TSA',
        'Trigger finger',
        'CTR',
        'Hip scope',
        'Knee arthroscopy',
      ],
      [procKey('General')]: [
        'Colonoscopy',
        'EGD',
        'EGD + Colonoscopy',
        'Cholecystectomy',
        'Appendectomy',
        'Dx laparotomy',
        'Exploratory laparotomy',
        'TIF',
      ],
      [procKey('ENT')]: ['Tonsils and adenoids', 'Septoplasty', 'Sinus scope', 'Nasal bone reduction'],
      [procKey('Podiatry')]: ['Bone procedure', 'Soft tissue procedure'],
      [procKey('GYN')]: ['Lap hyst', 'Vaginal hyst', 'Hysteroscopy', 'Suction D&C'],
    },
  ],
  [
    'v3',
    {
      anesthesia: [
        'General',
        'Spinal',
        'Epidural',
        'MAC',
        'Local + sedation',
        'Adductor canal block',
        'Interscalene block',
        'Supraclavicular block',
        'Popliteal block',
        'Ankle block',
        'Bier block',
        'TAP block',
      ],
    },
  ],
];

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
  for (const [ver, payload] of SEEDS) {
    if (!done.includes(ver)) {
      for (const [key, list] of Object.entries(payload)) {
        c[key] = [...new Set([...(c[key] ?? []), ...list])];
      }
      done.push(ver);
      changed = true;
    }
  }
  c.__seeded = done;
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

// Setup-transfer codes: the whole choice configuration (including __seeded,
// so removed defaults stay removed on the receiving device) as base64url JSON.
// Carried in a #setup= URL fragment, so it never leaves the devices involved.
export function encodeChoices(c: CustomChoices): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeChoices(s: string): CustomChoices | null {
  try {
    const b64 = s.trim().replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    for (const v of Object.values(parsed)) {
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) return null;
    }
    return parsed as CustomChoices;
  } catch {
    return null;
  }
}

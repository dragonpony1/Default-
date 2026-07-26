// Provider profiles: each provider (identified by initials) saves their
// standing CHOICES — the drug orders and setup they usually pick — so tapping
// their button "clicks them in" and pre-populates the forms. No patient data
// is ever stored here; these are provider preferences only, local to the
// device, wiped only when the provider chooses to delete their profile.

export interface ProviderPrefs {
  pacu?: { ck: Record<string, boolean>; tx: Record<string, string> };
  recordCk?: Record<string, boolean>; // record setup checkboxes (monitors, technique…)
  plannedAnesthesia?: string;
  providerName?: string; // stamped on record / PACU / billing signature lines
}

export interface ProviderProfile {
  id: string;
  initials: string;
  prefs: ProviderPrefs;
}

// Draft localStorage keys owned by the form components. Kept in sync with the
// KEY constants in AnesRecord/PacuOrders/BillingSheet/storage.
const REC = 'anes-record-draft-v1';
const PACU = 'pacu-orders-draft-v1';
const BILL = 'billing-sheet-draft-v1';
const PREOP = 'preop-eval-draft-v2';
const PROV = 'providers-v1';

// Record checkboxes that are per-case (not provider defaults) and must never be
// baked into a saved profile.
const RECORD_PERCASE = new Set([
  'hp',
  'opPermit',
  'consent',
  'chartReviewed',
  'asa1',
  'asa2',
  'asa3',
  'asa4',
  'asa5',
  'asaE',
]);

interface Draft {
  ck?: Record<string, boolean>;
  tx?: Record<string, string>;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// The department's providers, seeded on first run. Each starts with no saved
// defaults — a provider taps their button then "Save" once to store their setup.
const SEED_INITIALS = ['JG', 'MS', 'AP', 'SN', 'CS', 'SD', 'AL', 'EP', 'TA'];

export function loadProviders(): ProviderProfile[] {
  const stored = read<ProviderProfile[]>(PROV);
  if (stored && stored.length) return stored;
  const seeded = SEED_INITIALS.map((initials, i) => ({
    id: `p${i + 1}`,
    initials,
    prefs: {} as ProviderPrefs,
  }));
  saveProviders(seeded);
  return seeded;
}

export function saveProviders(list: ProviderProfile[]): void {
  localStorage.setItem(PROV, JSON.stringify(list));
}

// Snapshot the current forms into a set of provider preferences (no patient data).
export function captureCurrentPrefs(initials: string): ProviderPrefs {
  const pacu = read<Draft>(PACU);
  const rec = read<Draft>(REC);
  const preop = read<Record<string, unknown>>(PREOP);

  const recordCk: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(rec?.ck ?? {})) {
    if (!RECORD_PERCASE.has(k)) recordCk[k] = v;
  }

  return {
    pacu: { ck: pacu?.ck ?? {}, tx: pacu?.tx ?? {} },
    recordCk,
    plannedAnesthesia: typeof preop?.plannedAnesthesia === 'string' ? preop.plannedAnesthesia : '',
    providerName: (rec?.tx?.anesthetist || initials) as string,
  };
}

// Apply a provider's preferences to the form drafts by MERGING (so a case in
// progress keeps its per-case data). Writes the record/PACU/billing drafts
// directly; returns a patch for the pre-op state that App applies itself.
export function applyProviderToDrafts(prefs: ProviderPrefs): { plannedAnesthesia?: string } {
  const name = prefs.providerName ?? '';

  // PACU: merge their standing orders + stamp provider name.
  const pacu = read<Draft>(PACU) ?? {};
  localStorage.setItem(
    PACU,
    JSON.stringify({
      ck: { ...(pacu.ck ?? {}), ...(prefs.pacu?.ck ?? {}) },
      tx: { ...(pacu.tx ?? {}), ...(prefs.pacu?.tx ?? {}), ...(name ? { provider: name } : {}) },
    }),
  );

  // Record: merge their setup checkboxes + stamp anesthetist name.
  const rec = read<Draft>(REC) ?? {};
  localStorage.setItem(
    REC,
    JSON.stringify({
      ...rec,
      ck: { ...(rec.ck ?? {}), ...(prefs.recordCk ?? {}) },
      tx: { ...(rec.tx ?? {}), ...(name ? { anesthetist: name } : {}) },
    }),
  );

  // Billing: stamp CRNA name.
  if (name) {
    const bill = read<Draft>(BILL) ?? {};
    localStorage.setItem(BILL, JSON.stringify({ ...bill, tx: { ...(bill.tx ?? {}), crna: name } }));
  }

  return { plannedAnesthesia: prefs.plannedAnesthesia };
}

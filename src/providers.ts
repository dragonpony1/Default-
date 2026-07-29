// Provider profiles: each provider (identified by initials) saves their
// standing CHOICES — the drug orders, setup, and narration they usually pick —
// so tapping their button "clicks them in" and pre-populates the forms. No
// patient data is ever stored here; these are provider preferences only, local
// to the device, wiped only when the provider chooses to delete their profile.

export interface ProviderPrefs {
  pacu?: { ck: Record<string, boolean>; tx: Record<string, string> };
  recordCk?: Record<string, boolean>; // record setup checkboxes (monitors, airway, positioning…)
  inductionCells?: Record<string, string>; // induction drug doses (surgery-start column)
  airwayTx?: Record<string, string>; // tube size / length
  emergenceDoses?: { sugammadex?: string; zofran?: string; decadron?: string };
  narrative?: string; // record Remarks / narration
  plannedAnesthesia?: string;
  providerName?: string; // stamped on record / PACU / billing signature lines
}

export interface ProviderProfile {
  id: string;
  initials: string;
  prefs: ProviderPrefs;
  signature?: string; // saved signature image (data URL PNG), stamped with date/time
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

// Induction drug cells (surgery-start column 0) — match the wizard's Induction step.
const INDUCTION_CELLS = ['oth5:0', 'med3:0', 'med6:0', 'med7:0', 'med5:0', 'med4:0', 'oth6:0'];
// Airway text fields that are provider defaults (not per-case time/attempts).
const AIRWAY_TX = ['tubeSize', 'tubeLength'];
// Emergence drug grid rows.
const EMERGENCE_ROWS = { sugammadex: 'oth3', zofran: 'med8', decadron: 'oth7' } as const;

const STEP = 5;
const COLS = 36;

interface RecDraft {
  ck?: Record<string, boolean>;
  tx?: Record<string, string>;
  cells?: Record<string, string>;
}
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

function parseHHMM(s: string): number | null {
  const m = (s ?? '').trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Same end-of-graph column the record computes from surgery-start → anesthesia-stop.
function endColFor(tx: Record<string, string>): number {
  const s = parseHHMM(tx.surgStart ?? '');
  const e = parseHHMM(tx.anesStop ?? '');
  if (s == null || e == null) return COLS - 1;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return Math.max(0, Math.min(COLS - 1, Math.floor(diff / STEP)));
}

// Most recent non-empty dose in any column of a drug row (column-independent).
function lastDoseForRow(cells: Record<string, string>, row: string): string {
  let val = '';
  for (const [k, v] of Object.entries(cells)) {
    if (k.startsWith(`${row}:`) && v) val = v;
  }
  return val;
}

function pick(src: Record<string, string>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (src[k]) out[k] = src[k];
  return out;
}

// The department's providers, seeded on first run: initials for the buttons,
// full name for the signature lines. Each starts with no saved defaults — a
// provider taps their button then "Save" once to store their setup.
const SEED_PROVIDERS: Array<[initials: string, name: string]> = [
  ['JG', 'Jeff Green'],
  ['MS', 'Matt Smith'],
  ['AP', 'Annette Proctor'],
  ['SN', 'Stacey Nelsen'],
  ['CS', 'Chris Smith'],
  ['SD', 'Stephanie Dixon'],
  ['AL', 'Amy Lloyd'],
  ['EP', 'Evie Purdom'],
  ['TA', 'Taylor Albrecht'],
];
const SEED_NAMES = new Map(SEED_PROVIDERS);

export function loadProviders(): ProviderProfile[] {
  const stored = read<ProviderProfile[]>(PROV);
  if (stored && stored.length) {
    // Devices set up before the names were known carry initials only. Fill in
    // the blanks; a name a provider has already set for themselves stands.
    let changed = false;
    const named = stored.map((p) => {
      const seed = SEED_NAMES.get(p.initials.toUpperCase());
      if (!seed || (p.prefs.providerName ?? '').trim()) return p;
      changed = true;
      return { ...p, prefs: { ...p.prefs, providerName: seed } };
    });
    if (changed) saveProviders(named);
    return named;
  }
  const seeded = SEED_PROVIDERS.map(([initials, providerName], i) => ({
    id: `p${i + 1}`,
    initials,
    prefs: { providerName } as ProviderPrefs,
  }));
  saveProviders(seeded);
  return seeded;
}

export function saveProviders(list: ProviderProfile[]): void {
  localStorage.setItem(PROV, JSON.stringify(list));
}

// The name to print with a signature. Normally it was stored when the
// signature was stamped. A signature stamped before names existed carries
// none — so look it up by matching the image against the saved provider
// signatures. That is an identification, not a guess: no match, no name.
const nameCache = new Map<string, string>();

export function nameForSignature(sig: string, storedName?: string): string {
  const stored = (storedName ?? '').trim();
  if (stored) return stored;
  if (!sig) return '';
  const cached = nameCache.get(sig);
  if (cached !== undefined) return cached;
  const match = loadProviders().find((p) => p.signature && p.signature === sig);
  const found = match?.prefs.providerName?.trim() || match?.initials || '';
  nameCache.set(sig, found);
  return found;
}

// Snapshot the current forms into a set of provider preferences (no patient data).
export function captureCurrentPrefs(initials: string): ProviderPrefs {
  const pacu = read<Draft>(PACU);
  const rec = read<RecDraft>(REC);
  const preop = read<Record<string, unknown>>(PREOP);

  const recCk = rec?.ck ?? {};
  const recTx = rec?.tx ?? {};
  const recCells = rec?.cells ?? {};

  const recordCk: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(recCk)) {
    if (!RECORD_PERCASE.has(k)) recordCk[k] = v;
  }

  return {
    pacu: { ck: pacu?.ck ?? {}, tx: pacu?.tx ?? {} },
    recordCk,
    inductionCells: pick(recCells, INDUCTION_CELLS),
    airwayTx: pick(recTx, AIRWAY_TX),
    emergenceDoses: {
      sugammadex: lastDoseForRow(recCells, EMERGENCE_ROWS.sugammadex),
      zofran: lastDoseForRow(recCells, EMERGENCE_ROWS.zofran),
      decadron: lastDoseForRow(recCells, EMERGENCE_ROWS.decadron),
    },
    narrative: recTx.remarks ?? '',
    plannedAnesthesia: typeof preop?.plannedAnesthesia === 'string' ? preop.plannedAnesthesia : '',
    providerName: recTx.anesthetist || initials,
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

  // Record: merge setup checkboxes, induction doses, airway defaults, emergence
  // doses (placed at the current end-of-graph column), narration, and name.
  const rec = read<RecDraft>(REC) ?? {};
  const recTx = { ...(rec.tx ?? {}) };
  const endCol = endColFor(recTx);
  const cells = { ...(rec.cells ?? {}), ...(prefs.inductionCells ?? {}) };
  const em = prefs.emergenceDoses ?? {};
  if (em.sugammadex) cells[`${EMERGENCE_ROWS.sugammadex}:${endCol}`] = em.sugammadex;
  if (em.zofran) cells[`${EMERGENCE_ROWS.zofran}:${endCol}`] = em.zofran;
  if (em.decadron) cells[`${EMERGENCE_ROWS.decadron}:${endCol}`] = em.decadron;

  localStorage.setItem(
    REC,
    JSON.stringify({
      ...rec,
      ck: { ...(rec.ck ?? {}), ...(prefs.recordCk ?? {}) },
      tx: {
        ...recTx,
        ...(prefs.airwayTx ?? {}),
        ...(prefs.narrative ? { remarks: prefs.narrative } : {}),
        ...(name ? { anesthetist: name } : {}),
      },
      cells,
    }),
  );

  // Billing: stamp CRNA name.
  if (name) {
    const bill = read<Draft>(BILL) ?? {};
    localStorage.setItem(BILL, JSON.stringify({ ...bill, tx: { ...(bill.tx ?? {}), crna: name } }));
  }

  return { plannedAnesthesia: prefs.plannedAnesthesia };
}

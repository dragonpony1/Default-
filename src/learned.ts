// Things typed once that get typed again: surgeons, procedures, diagnoses,
// the drug on an added med row. The app remembers them per box and offers them
// back, so the second Dr. Nguyen case is a tap rather than a spelling test.
//
// Provider preferences, not patient data: a surgeon's name and a procedure are
// no more identifying than the printed form's own word list, and nothing here
// leaves the device. Entered values are remembered on blur — a half-typed word
// is not a word — and the list can be pruned in Edit Choices.

const KEY = 'learned-v1';
const MAX_PER_BUCKET = 40;
const MIN_LENGTH = 2;

export type Bucket = 'surgeon' | 'procedure' | 'diagnosis' | 'medRow';

export const BUCKET_LABELS: Record<Bucket, string> = {
  surgeon: 'Surgeons',
  procedure: 'Procedures',
  diagnosis: 'Diagnoses',
  medRow: 'Added med rows',
};

interface Entry {
  v: string; // as typed
  n: number; // times entered
  t: number; // last used, ms
}

type Store = Partial<Record<Bucket, Entry[]>>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // A full disk should never cost someone their charting.
  }
}

// Most used first, and among equals the most recent — the surgeon on today's
// list beats the one from a month ago.
const rank = (a: Entry, b: Entry) => b.n - a.n || b.t - a.t;

export function learned(bucket: Bucket): string[] {
  return (read()[bucket] ?? []).slice().sort(rank).map((e) => e.v);
}

export function remember(bucket: Bucket, value: string, now = Date.now()): void {
  const v = value.trim().replace(/\s+/g, ' ');
  if (v.length < MIN_LENGTH) return;
  const s = read();
  const list = s[bucket] ?? [];
  // Case-insensitive match, but the spelling last used is the one kept.
  const at = list.findIndex((e) => e.v.toLowerCase() === v.toLowerCase());
  if (at >= 0) list[at] = { v, n: list[at].n + 1, t: now };
  else list.push({ v, n: 1, t: now });
  s[bucket] = list.sort(rank).slice(0, MAX_PER_BUCKET);
  write(s);
}

export function forget(bucket: Bucket, value: string): void {
  const s = read();
  s[bucket] = (s[bucket] ?? []).filter((e) => e.v !== value);
  write(s);
}

export function forgetBucket(bucket: Bucket): void {
  const s = read();
  delete s[bucket];
  write(s);
}

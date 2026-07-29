// The record, PACU orders and billing sheet each keep their own draft in
// localStorage. The pre-print review reads all three to find what is still
// blank, and writes answers straight back into them — so these are the keys
// and the two-line accessors, in one place instead of three.

export const ANES_KEY = 'anes-record-draft-v1';
export const PACU_KEY = 'pacu-orders-draft-v1';
export const BILLING_KEY = 'billing-sheet-draft-v1';

export interface SheetDraft {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
}

export function readSheet(key: string): SheetDraft {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ck: {}, tx: {} };
    const parsed = JSON.parse(raw) as Partial<SheetDraft>;
    return { ck: parsed.ck ?? {}, tx: parsed.tx ?? {} };
  } catch {
    return { ck: {}, tx: {} };
  }
}

// Written back field by field, keeping everything else in the draft as it is —
// the record's charted cells and vitals live in the same object.
function patch(key: string, apply: (raw: Record<string, unknown>) => void): void {
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
  } catch {
    obj = {};
  }
  if (typeof obj.ck !== 'object' || obj.ck === null) obj.ck = {};
  if (typeof obj.tx !== 'object' || obj.tx === null) obj.tx = {};
  apply(obj);
  localStorage.setItem(key, JSON.stringify(obj));
}

export function writeSheetTx(key: string, field: string, value: string): void {
  patch(key, (o) => {
    (o.tx as Record<string, string>)[field] = value;
  });
}

export function writeSheetCk(key: string, field: string, value: boolean): void {
  patch(key, (o) => {
    (o.ck as Record<string, boolean>)[field] = value;
  });
}

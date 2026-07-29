import { useSyncExternalStore } from 'react';

// A single "Case" that holds patient-level info shared across every form
// (pre-op, anesthesia record, PACU orders, billing, future block record).
// Enter something once and it pre-populates the other documents; it all lives
// until the Clear form button wipes the case. Local-only, like everything else.
//
// Kept intentionally small and flat so it's easy to add shared fields later
// (demographics, procedure, provider, etc.). Allergies is the first field.

export interface CaseData {
  allergies: string;
  weight: string; // lb
  weightKg: string;
  height: string;
  procedure: string; // proposed procedure, from the pre-op
  diagnosis: string; // problem list / diagnoses, from the pre-op
  surgeon: string;
}

const KEY = 'anes-case-v1';
const empty: CaseData = { allergies: '', weight: '', weightKg: '', height: '', procedure: '', diagnosis: '', surgeon: '' };

function read(): CaseData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    return { ...empty, ...(JSON.parse(raw) as Partial<CaseData>) };
  } catch {
    return { ...empty };
  }
}

// Module-level snapshot + subscribers so any mounted form re-renders when the
// case changes (useSyncExternalStore needs a referentially-stable snapshot,
// so we only swap `current` when a value actually changes).
let current = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getCase(): CaseData {
  return current;
}

export function setCaseField<K extends keyof CaseData>(k: K, v: CaseData[K]): void {
  if (current[k] === v) return;
  current = { ...current, [k]: v };
  localStorage.setItem(KEY, JSON.stringify(current));
  emit();
}

export function clearCase(): void {
  current = { ...empty };
  localStorage.removeItem(KEY);
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useCaseData(): CaseData {
  return useSyncExternalStore(subscribe, getCase, getCase);
}

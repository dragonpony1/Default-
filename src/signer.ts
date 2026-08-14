import { useSyncExternalStore } from 'react';

// The currently "clicked-in" provider's signature, so any form can stamp it.
// Set when a provider is selected in the provider bar. Holds only the
// provider's own initials + their saved signature image — no patient data —
// and being clicked in survives a relaunch: whoever holds the tablet is still
// themselves after closing the app, so the billing sheet's CRNA line and the
// sign buttons work without a re-tap. Clear form keeps it for the same reason.

export interface Signer {
  initials: string;
  name: string; // full name, shown on signature lines before signing
  signature: string; // data URL PNG, or '' if none saved
}

const empty: Signer = { initials: '', name: '', signature: '' };
const KEY = 'signer-v1';

function read(): Signer {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Partial<Signer>) };
  } catch {
    return empty;
  }
}

let current: Signer = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getSigner(): Signer {
  return current;
}

export function setSigner(s: Signer): void {
  current = s;
  localStorage.setItem(KEY, JSON.stringify(s));
  emit();
}

export function clearSigner(): void {
  current = empty;
  localStorage.removeItem(KEY);
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useSigner(): Signer {
  return useSyncExternalStore(subscribe, getSigner, getSigner);
}

// Current date (MM/DD/YY) and time (HHMM) for a signature stamp.
export function nowStamp(): { date: string; time: string } {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${mm}/${dd}/${yy}`, time: `${hh}${min}` };
}

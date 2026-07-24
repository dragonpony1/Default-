import { emptyPreopEval, type PreopEval } from './types';

// All data stays in this browser via localStorage. Nothing ever leaves the
// device; "Clear form" removes the draft entirely.
const KEY = 'preop-eval-draft-v2';

export function loadDraft(): PreopEval {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...emptyPreopEval };
    return { ...emptyPreopEval, ...JSON.parse(raw) };
  } catch {
    return { ...emptyPreopEval };
  }
}

export function saveDraft(data: PreopEval): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearDraft(): void {
  localStorage.removeItem(KEY);
}

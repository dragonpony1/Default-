// User-added options for the systems-review choice lists. Stored separately
// from the patient draft so they survive "Clear form" — they are part of how
// this device's form is configured, not patient data.
const KEY = 'preop-custom-choices-v1';

export type CustomChoices = Record<string, string[]>;

export function loadCustomChoices(): CustomChoices {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomChoices) : {};
  } catch {
    return {};
  }
}

export function saveCustomChoices(choices: CustomChoices): void {
  localStorage.setItem(KEY, JSON.stringify(choices));
}

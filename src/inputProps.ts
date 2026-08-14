// Medical text — drug names, abbreviations, dosages — must never be
// autocorrected by the OS keyboard. Spread onto every free-text input.
export const noAuto = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
} as const;

// Numeric fields: suppress the OS keyboard entirely and summon the floating
// 10-key pad instead (see NumPad.tsx). The pad's ABC key restores the OS
// keyboard for a field when free text is genuinely needed.
export const numPad = {
  ...noAuto,
  inputMode: 'none',
  'data-np': '1',
} as const;

// Time boxes: the 10-key, plus a Now key that stamps the current HHMM.
export const timePad = {
  ...noAuto,
  inputMode: 'none',
  'data-np': '1',
  'data-timefield': '1',
} as const;

// The NPO box: a time pad whose pad also offers the word Midnight.
export const npoPad = {
  ...noAuto,
  inputMode: 'none',
  'data-np': '1',
  'data-timefield': '1',
  'data-npo': '1',
} as const;

// Date boxes: floating date picker (Today plus wheels) instead of typing.
export const datePad = {
  ...noAuto,
  inputMode: 'none',
  'data-datepad': '1',
} as const;

// Temperature fields: floating slider pad instead of any keyboard.
export const tempPad = {
  ...noAuto,
  inputMode: 'none',
  'data-temp': '1',
} as const;

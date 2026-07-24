// Medical text — drug names, abbreviations, dosages — must never be
// autocorrected by the OS keyboard. Spread onto every free-text input.
export const noAuto = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
} as const;

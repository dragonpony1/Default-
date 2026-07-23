# Anesthesia Charting

Electronic charting for an anesthesia department that prints to paper forms.
The hospital's official record is paper, so this app is a fast way to chart
electronically and produce a clean, printed US-Letter form.

## Privacy model

- **Local-only**: the app runs entirely in the browser. There is no server and
  no network calls — patient data never leaves the device.
- Drafts are kept in the browser's localStorage so an in-progress evaluation
  survives a page reload. Use **Clear form** after printing to remove all data
  from the device.

## Forms

- **Pre-anesthesia evaluation** — implemented (placeholder layout; will be
  updated to match the hospital's existing paper form).

Planned: intra-op anesthesia record, PACU note, controlled substance log.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
```

Print with the toolbar's **Print** button (or Ctrl/Cmd+P); the print stylesheet
formats the form for US Letter with 0.5in margins.

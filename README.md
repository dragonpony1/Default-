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

- **Pre-anesthesia evaluation** — implemented, matching Mountain West Medical
  Center form 170-165-90061 (03/12, Rev. 03/22): systems review with WNL and
  condition checkboxes, tobacco/ethanol screening, diagnostics and laboratory
  study columns, post-anesthesia note, physical status, inpatient note, and
  signature blocks. Prints on a single US Letter page.

Planned: intra-op anesthesia record, PACU note, controlled substance log.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
```

Print with the toolbar's **Print** button (or Ctrl/Cmd+P); the print stylesheet
formats the form for US Letter with 0.5in margins.

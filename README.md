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

## Installing on a tablet

The app is a PWA and works fully offline after the first visit. On an Android
tablet, open the GitHub Pages URL in Chrome, then **⋮ → Add to Home screen**
(or "Install app"). The installed app opens full-screen, loads with no network,
and picks up new versions automatically the next time it's online. Printing
uses Android's print dialog, so a Bluetooth printer works once its
manufacturer's print service app is installed on the tablet.

## Forms

- **Pre-anesthesia evaluation** — implemented, matching Mountain West Medical
  Center form 170-165-90061 (03/12, Rev. 03/22): systems review with WNL and
  condition checkboxes, tobacco/ethanol screening, diagnostics and laboratory
  study columns, post-anesthesia note, physical status, inpatient note, and
  signature blocks. Prints on a single US Letter page. No patient identifiers
  are entered — the patient label sticker is applied after printing.

- **Intra-op anesthesia record** — implemented, matching form 170-165-MW250046HMS
  with a time-anchored charting grid and draggable BP/HR vitals.
- **Post-Anesthesia Recovery Room Orders** — implemented, matching form
  170-165-1131001HMSFAC (01/15, Rev. 07/15, 07/22): dose blanks, breakthrough-pain
  priority checkboxes, call criteria, and free order lines 16–18.
- **Deseret Peak Anesthesia Billing Information** — implemented: tappable CPT-code
  table, modifier checks (age, ASA, prone, position), block and line codes, and an
  add-a-code blank.

Planned: controlled substance log.

## App structure

Four tabs, all reading and writing the same draft:

- **Gather Info** — the whole intake as a checklist of collapsible sections;
  each collapsed row shows a one-line summary of what's entered.
- **Pre-Op Wizard** — one question at a time (35 steps) with a progress bar,
  Restart / Review all controls, and a review screen listing every field with
  tap-to-edit. The wizard's step position persists per device.
- **Paper Form** — the print-exact replica; Print always outputs this view.
- **Edit Choices** — per-device configuration of every choice list (stored
  separately from patient drafts, survives Clear form).

Structured entry (in both Gather Info and the wizard):

- **Procedure**: service tabs (Ortho / General / ENT / Podiatry / GYN) with
  seeded per-service procedure chips, then Left/Right side chips; the side is
  stored as a text prefix ("Right TKA").
- **Medications**: offline type-ahead over `src/meds.ts` (~230 generics +
  brands); one row per med with dose/frequency; anticoagulants, antiplatelets,
  GLP-1s, and insulins are badged and prompt for last dose taken.
- **Allergies**: offline type-ahead over `src/allergens.ts`; reaction field
  per row; OR-critical allergens (latex, chlorhexidine, cefazolin,
  propofol/egg/soy, succinylcholine, MH, heparin/HIT…) badged OR Alert.
- **Previous anesthesia / operations**: type-ahead over `src/prevhx.ts`;
  red flags for difficult airway / MH / post-op ICU / pseudocholinesterase
  deficiency, amber for PONV / awareness / cardiac / bariatric history.
- **Planned anesthesia**: multi-select chips (General, Spinal, MAC, blocks…)
  that join with " + " into the printed text.
- **Systems review**: on-screen OSA and CPAP are separate (either checks the
  printed combined OSA/CPAP box); Home O2 question (night / 24-7, L/min)
  prints into Respiratory comments; per-condition detail fields and custom
  conditions print into each system's Comments column.

Structured entries print as lines inside the original form's boxes — the
printed checkbox grid itself is never altered. Choice lists are seeded via
versioned payloads in `src/choices.ts` (removals stick across seed upgrades)
and are user-extendable on the Edit Choices tab. All free-text inputs disable
OS autocorrect/autocapitalize (`src/inputProps.ts`).

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
```

Print with the toolbar's **Print** button (or Ctrl/Cmd+P); the print stylesheet
formats the form for US Letter with 0.5in margins.

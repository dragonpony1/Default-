import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { SYSTEMS } from './formConfig';
import { SERVICES, procKey, decodeChoices, encodeChoices, type CustomChoices } from './choices';
import AddEntry from './AddEntry';
import { noAuto } from './inputProps';

interface Props {
  choices: CustomChoices;
  setChoices: (c: CustomChoices) => void;
}

// Lets the user extend each choice-list field with their own options. Added
// options behave like the built-in ones everywhere (chips, details, printing
// into the Comments column) and are kept on this device across patients.
export default function EditChoices({ choices, setChoices }: Props) {
  const [svc, setSvc] = useState<string>('Ortho');
  const [showXfer, setShowXfer] = useState(false);
  const [qr, setQr] = useState('');
  const [pasted, setPasted] = useState('');
  const [copied, setCopied] = useState(false);

  const setupCode = encodeChoices(choices);
  const setupUrl = `${window.location.origin}${window.location.pathname}#setup=${setupCode}`;

  useEffect(() => {
    if (!showXfer) return;
    QRCode.toDataURL(setupUrl, { errorCorrectionLevel: 'L', margin: 1, width: 320 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [showXfer, setupUrl]);

  const importPasted = () => {
    const raw = pasted.trim();
    // Accept a bare code or a full pasted link containing #setup=
    const code = raw.includes('#setup=') ? raw.split('#setup=')[1] : raw;
    const imported = decodeChoices(code);
    if (!imported) {
      window.alert('That code could not be read. Copy the whole code (or link) from the other device and try again.');
      return;
    }
    if (window.confirm('Replace the choice lists on THIS device with the pasted setup? Patient data is not affected.')) {
      setChoices(imported);
      setPasted('');
      window.alert('Setup loaded.');
    }
  };

  const add = (key: string, label: string) => {
    const existing = choices[key] ?? [];
    if (existing.includes(label)) return;
    setChoices({ ...choices, [key]: [...existing, label] });
  };

  const remove = (key: string, label: string) => {
    setChoices({ ...choices, [key]: (choices[key] ?? []).filter((l) => l !== label) });
  };

  return (
    <div className="intake screen-only">
      <section className="icard">
        <h2>Edit Choices</h2>
        <p className="fbf-hint">
          Add your own options to any condition list below. Added options appear as regular choices
          in Gather Info and the Pre-Op Wizard on this device, for every patient, until you remove
          them here. When checked, they print into that system&rsquo;s Comments column &mdash; the
          printed checkbox layout itself stays identical to the hospital form. Fixed clinical scales
          (sex, Mallampati class, ASA physical status) are not editable.
        </p>
      </section>
      <section className="icard">
        <h2>Copy Setup to Another Device</h2>
        <p className="fbf-hint">
          Everything on this tab (procedures, dictionaries, added conditions) is stored per device.
          To copy this device&rsquo;s setup onto another tablet: show the code here, then scan it
          with the other tablet&rsquo;s camera &mdash; the app opens there and asks to load it.
          Patient data is never part of the code.
        </p>
        <div className="chips">
          <button type="button" className={`chip${showXfer ? ' on' : ''}`} onClick={() => setShowXfer(!showXfer)}>
            {showXfer ? 'Hide transfer code' : 'Show transfer code'}
          </button>
        </div>
        {showXfer && (
          <>
            {qr && <img className="xfer-qr" src={qr} alt="Setup transfer QR code" />}
            <p className="fbf-hint">
              Scanning needs the other device to be online once (to open the app). If the camera
              route is awkward &mdash; e.g. onto an iPad&rsquo;s installed app &mdash; copy the code
              instead, get it to the other device any way you like, and paste it in the box below
              on that device.
            </p>
            <div className="chips">
              <button
                type="button"
                className="chip"
                onClick={() => {
                  navigator.clipboard?.writeText(setupCode).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                {copied ? '✓ Copied' : 'Copy setup code'}
              </button>
            </div>
          </>
        )}
        <div className="ifield">
          <span>Paste a setup code from another device</span>
          <textarea
            {...noAuto}
            rows={2}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste the code (or the whole link) here…"
          />
        </div>
        {pasted.trim() && (
          <div className="chips">
            <button type="button" className="chip on" onClick={importPasted}>
              Load pasted setup onto this device
            </button>
          </div>
        )}
      </section>
      <section className="icard">
        <h2>Proposed Procedure</h2>
        <p className="fbf-hint">
          Procedures are grouped by service. Pick a service tab, then add the procedures you do
          most &mdash; they become one-tap choices on the procedure question. Anything else can
          still be typed in free text.
        </p>
        <div className="chips wrap">
          {SERVICES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip svc${svc === s ? ' on' : ''}`}
              onClick={() => setSvc(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="chips wrap">
          {(choices[procKey(svc)] ?? []).map((label) => (
            <button
              type="button"
              className="chip on"
              key={`proc:${label}`}
              title="Remove this option"
              onClick={() => remove(procKey(svc), label)}
            >
              {label} ✕
            </button>
          ))}
        </div>
        <AddEntry onAdd={(label) => add(procKey(svc), label)} placeholder={`Add a ${svc} procedure…`} />
      </section>
      <section className="icard">
        <h2>Medication Dictionary</h2>
        <p className="fbf-hint">
          The med search already knows a few hundred common medications. Add anything it misses
          here and it will show up in the type-ahead suggestions on this device.
        </p>
        <div className="chips wrap">
          {(choices.meds ?? []).map((label) => (
            <button
              type="button"
              className="chip on"
              key={`med:${label}`}
              title="Remove this medication"
              onClick={() => remove('meds', label)}
            >
              {label} ✕
            </button>
          ))}
        </div>
        <AddEntry onAdd={(label) => add('meds', label)} placeholder="Add a medication…" />
      </section>
      <section className="icard">
        <h2>Allergy Dictionary</h2>
        <p className="fbf-hint">
          Same idea for allergies &mdash; add anything the type-ahead misses and it will be
          suggested on this device.
        </p>
        <div className="chips wrap">
          {(choices.allergens ?? []).map((label) => (
            <button
              type="button"
              className="chip on"
              key={`al:${label}`}
              title="Remove this allergen"
              onClick={() => remove('allergens', label)}
            >
              {label} ✕
            </button>
          ))}
        </div>
        <AddEntry onAdd={(label) => add('allergens', label)} placeholder="Add an allergen…" />
      </section>
      <section className="icard">
        <h2>Surgery / Anesthesia History Dictionary</h2>
        <p className="fbf-hint">
          Add prior surgeries or anesthesia events the type-ahead misses and they will be suggested
          on this device.
        </p>
        <div className="chips wrap">
          {(choices.prevhx ?? []).map((label) => (
            <button
              type="button"
              className="chip on"
              key={`ph:${label}`}
              title="Remove this entry"
              onClick={() => remove('prevhx', label)}
            >
              {label} ✕
            </button>
          ))}
        </div>
        <AddEntry onAdd={(label) => add('prevhx', label)} placeholder="Add a surgery or event…" />
      </section>
      <section className="icard">
        <h2>Planned Anesthesia</h2>
        <p className="fbf-hint">
          One-tap choices for the anesthetic plan. Selections combine with &ldquo;+&rdquo; on the
          form (e.g. Spinal + Adductor canal block).
        </p>
        <div className="chips wrap">
          {(choices.anesthesia ?? []).map((label) => (
            <button
              type="button"
              className="chip on"
              key={`an:${label}`}
              title="Remove this option"
              onClick={() => remove('anesthesia', label)}
            >
              {label} ✕
            </button>
          ))}
        </div>
        <AddEntry onAdd={(label) => add('anesthesia', label)} placeholder="Add an anesthesia option…" />
      </section>
      {SYSTEMS.map((s) => {
        const custom = choices[s.key] ?? [];
        return (
          <section className="icard" key={s.key}>
            <h2>{s.title}</h2>
            <div className="chips wrap">
              {s.col1.concat(s.col2 ?? []).map((label) => (
                <span className="chip fixed" key={label}>{label}</span>
              ))}
              {custom.map((label) => (
                <button
                  type="button"
                  className="chip on"
                  key={`custom:${label}`}
                  title="Remove this option"
                  onClick={() => remove(s.key, label)}
                >
                  {label} ✕
                </button>
              ))}
            </div>
            <AddEntry onAdd={(label) => add(s.key, label)} />
          </section>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import { SYSTEMS } from './formConfig';
import { SERVICES, procKey, type CustomChoices } from './choices';
import AddEntry from './AddEntry';

interface Props {
  choices: CustomChoices;
  setChoices: (c: CustomChoices) => void;
}

// Lets the user extend each choice-list field with their own options. Added
// options behave like the built-in ones everywhere (chips, details, printing
// into the Comments column) and are kept on this device across patients.
export default function EditChoices({ choices, setChoices }: Props) {
  const [svc, setSvc] = useState<string>('Ortho');

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

import { SYSTEMS } from './formConfig';
import type { CustomChoices } from './choices';
import AddEntry from './AddEntry';

interface Props {
  choices: CustomChoices;
  setChoices: (c: CustomChoices) => void;
}

// Lets the user extend each choice-list field with their own options. Added
// options behave like the built-in ones everywhere (chips, details, printing
// into the Comments column) and are kept on this device across patients.
export default function EditChoices({ choices, setChoices }: Props) {
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

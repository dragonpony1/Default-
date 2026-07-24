import type { PreopEval } from './types';
import type { CustomChoices } from './choices';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  customChoices: CustomChoices;
}

// Multi-select chips for the anesthetic plan. Real plans are combinations
// ("Spinal + Adductor canal block"), so selections join with " + " in the
// same free-text value that prints — chips and typing stay interchangeable.
export default function AnesthesiaPicker({ d, set, customChoices }: Props) {
  const options = customChoices.anesthesia ?? [];
  const parts = d.plannedAnesthesia.split(' + ').map((s) => s.trim()).filter(Boolean);

  const toggle = (label: string) => {
    const next = parts.includes(label)
      ? parts.filter((x) => x !== label)
      : [...parts, label];
    set('plannedAnesthesia', next.join(' + '));
  };

  if (options.length === 0) return null;

  return (
    <div className="chips wrap">
      {options.map((label) => (
        <button
          key={label}
          type="button"
          className={`chip${parts.includes(label) ? ' on' : ''}`}
          onClick={() => toggle(label)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

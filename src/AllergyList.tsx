import { useState } from 'react';
import type { AllergyEntry, PreopEval } from './types';
import { isOrAlert, searchAllergens } from './allergens';
import type { CustomChoices } from './choices';
import { noAuto } from './inputProps';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  customChoices: CustomChoices;
}

// Structured allergy entry: offline type-ahead, one row per allergen with a
// reaction field. Allergens that change OR setup or anesthetic plan are
// badged OR ALERT.
export default function AllergyList({ d, set, customChoices }: Props) {
  const [q, setQ] = useState('');
  const suggestions = searchAllergens(q, customChoices.allergens ?? []);

  const addAllergy = (name: string) => {
    const label = name.trim();
    if (!label) return;
    if (d.allergyList.some((x) => x.name.toLowerCase() === label.toLowerCase())) {
      setQ('');
      return;
    }
    set('allergyList', [...d.allergyList, { name: label, reaction: '' }]);
    setQ('');
  };

  const update = (i: number, patch: Partial<AllergyEntry>) =>
    set('allergyList', d.allergyList.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const remove = (i: number) => set('allergyList', d.allergyList.filter((_, j) => j !== i));

  return (
    <div className="medlist">
      {d.allergyList.map((al, i) => {
        const alert = isOrAlert(al.name);
        return (
          <div className={`medrow${alert ? ' oralert' : ''}`} key={`${al.name}:${i}`}>
            <div className="medrow-main">
              <span className="medname">{al.name}</span>
              {alert && <span className="medclass or">OR Alert</span>}
              <input
                {...noAuto}
                className="meddose"
                placeholder="reaction (rash, anaphylaxis…)"
                value={al.reaction}
                onChange={(e) => update(i, { reaction: e.target.value })}
              />
              <button type="button" className="chip medremove" onClick={() => remove(i)}>
                ✕
              </button>
            </div>
          </div>
        );
      })}
      <div className="addentry">
        <input
          {...noAuto}
          value={q}
          placeholder="Type an allergy…"
          disabled={d.allergiesNone}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addAllergy(suggestions[0] ?? q);
            }
          }}
        />
        <button type="button" className="chip" disabled={!q.trim()} onClick={() => addAllergy(q)}>
          + Add
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="chips wrap medsuggest">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => addAllergy(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

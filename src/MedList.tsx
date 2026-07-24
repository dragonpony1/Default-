import { useState } from 'react';
import type { MedEntry, PreopEval } from './types';
import { classOf, searchMeds, CLASS_LABELS, LAST_DOSE_CLASSES } from './meds';
import type { CustomChoices } from './choices';
import { noAuto } from './inputProps';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  customChoices: CustomChoices;
}

// Strip the "(generic)" suffix a brand suggestion carries before class lookup.
function medClass(name: string) {
  const paren = name.match(/^(.+?)\s+\((.+)\)$/);
  return classOf(paren ? paren[2] : name) || (paren ? classOf(paren[1]) : '');
}

// Structured med entry: offline type-ahead, one row per med with optional
// dose, and a "last dose" prompt for anesthesia-critical classes.
export default function MedList({ d, set, customChoices }: Props) {
  const [q, setQ] = useState('');
  const suggestions = searchMeds(q, customChoices.meds ?? []);

  const addMed = (name: string) => {
    const label = name.trim();
    if (!label) return;
    if (d.meds.some((x) => x.name.toLowerCase() === label.toLowerCase())) {
      setQ('');
      return;
    }
    set('meds', [...d.meds, { name: label, dose: '', lastDose: '' }]);
    setQ('');
  };

  const update = (i: number, patch: Partial<MedEntry>) =>
    set('meds', d.meds.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const remove = (i: number) => set('meds', d.meds.filter((_, j) => j !== i));

  return (
    <div className="medlist">
      {d.meds.map((med, i) => {
        const cls = medClass(med.name);
        const needsLastDose = LAST_DOSE_CLASSES.includes(cls);
        return (
          <div className={`medrow${needsLastDose ? ' flagged' : ''}`} key={`${med.name}:${i}`}>
            <div className="medrow-main">
              <span className="medname">{med.name}</span>
              {cls && <span className={`medclass ${cls}`}>{CLASS_LABELS[cls as keyof typeof CLASS_LABELS]}</span>}
              <input
                {...noAuto}
                className="meddose"
                placeholder="dose / frequency"
                value={med.dose}
                onChange={(e) => update(i, { dose: e.target.value })}
              />
              <button type="button" className="chip medremove" onClick={() => remove(i)}>
                ✕
              </button>
            </div>
            {needsLastDose && (
              <label className="ifield detail medlast">
                <span>Last dose taken</span>
                <input
                  {...noAuto}
                  placeholder="date / time of last dose"
                  value={med.lastDose}
                  onChange={(e) => update(i, { lastDose: e.target.value })}
                />
              </label>
            )}
          </div>
        );
      })}
      <div className="addentry">
        <input
          {...noAuto}
          value={q}
          placeholder="Type a medication…"
          disabled={d.currentMedicationsNone}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addMed(suggestions[0] ?? q);
            }
          }}
        />
        <button type="button" className="chip" disabled={!q.trim()} onClick={() => addMed(q)}>
          + Add
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="chips wrap medsuggest">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => addMed(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

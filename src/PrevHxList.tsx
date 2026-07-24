import { useState } from 'react';
import type { PrevHxEntry, PreopEval } from './types';
import { prevFlag, searchPrevHx } from './prevhx';
import type { CustomChoices } from './choices';
import { noAuto } from './inputProps';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  customChoices: CustomChoices;
}

// Structured previous anesthesia / surgery entry: offline type-ahead, one
// row per item with a year/details field. Anesthesia-plan-changing history
// (difficult airway, MH, PONV, cardiac) is badged.
export default function PrevHxList({ d, set, customChoices }: Props) {
  const [q, setQ] = useState('');
  const suggestions = searchPrevHx(q, customChoices.prevhx ?? []);

  const addItem = (name: string) => {
    const label = name.trim();
    if (!label) return;
    if (d.prevHxList.some((x) => x.name.toLowerCase() === label.toLowerCase())) {
      setQ('');
      return;
    }
    set('prevHxList', [...d.prevHxList, { name: label, detail: '' }]);
    setQ('');
  };

  const update = (i: number, patch: Partial<PrevHxEntry>) =>
    set('prevHxList', d.prevHxList.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const remove = (i: number) => set('prevHxList', d.prevHxList.filter((_, j) => j !== i));

  return (
    <div className="medlist">
      {d.prevHxList.map((item, i) => {
        const flag = prevFlag(item.name);
        return (
          <div
            className={`medrow${flag ? (flag.level === 'red' ? ' oralert' : ' flagged') : ''}`}
            key={`${item.name}:${i}`}
          >
            <div className="medrow-main">
              <span className="medname">{item.name}</span>
              {flag && (
                <span className={`medclass ${flag.level === 'red' ? 'or' : ''}`}>{flag.label}</span>
              )}
              <input
                {...noAuto}
                className="meddose"
                placeholder="year / details"
                value={item.detail}
                onChange={(e) => update(i, { detail: e.target.value })}
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
          placeholder="Type a surgery or anesthesia event…"
          disabled={d.previousAnesthesiaNone}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem(suggestions[0] ?? q);
            }
          }}
        />
        <button type="button" className="chip" disabled={!q.trim()} onClick={() => addItem(q)}>
          + Add
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="chips wrap medsuggest">
          {suggestions.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => addItem(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { PreopEval } from './types';
import { SERVICES, procKey, type CustomChoices } from './choices';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  customChoices: CustomChoices;
}

const SIDES = ['Left', 'Right'] as const;

// The side is stored as a prefix of the free-text value itself ("Left TKA"),
// so it prints as written and free-typed procedures get the same treatment.
function parseSide(v: string): { side: string; base: string } {
  for (const s of SIDES) {
    if (v.startsWith(`${s} `)) return { side: s, base: v.slice(s.length + 1) };
  }
  return { side: '', base: v };
}

// Service tabs (Ortho, General, ENT, ...) over that service's procedure
// chips, then Left/Right once a procedure is chosen. One tap fills the
// proposed-procedure field; free text stays available next to this picker.
export default function ProcedurePicker({ d, set, customChoices }: Props) {
  const { side, base } = parseSide(d.proposedProcedure);
  const [svc, setSvc] = useState<string>(
    () => SERVICES.find((s) => (customChoices[procKey(s)] ?? []).includes(base)) ?? 'Ortho',
  );
  const list = customChoices[procKey(svc)] ?? [];

  const setProc = (b: string, s: string) =>
    set('proposedProcedure', b ? (s ? `${s} ${b}` : b) : '');

  return (
    <div className="procpick">
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
      {list.length > 0 ? (
        <div className="chips wrap">
          {list.map((label) => (
            <button
              key={label}
              type="button"
              className={`chip${base === label ? ' on' : ''}`}
              onClick={() => (base === label ? setProc('', '') : setProc(label, side))}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="ihint">No {svc} procedures yet &mdash; add them on the Edit Choices tab.</p>
      )}
      {base && (
        <div className="chips sides">
          <span className="side-label">Side</span>
          {SIDES.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${side === s ? ' on' : ''}`}
              onClick={() => setProc(base, side === s ? '' : s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { PreopEval } from './types';
import { SERVICES, procKey, type CustomChoices } from './choices';

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  customChoices: CustomChoices;
}

// Service tabs (Ortho, General, ENT, ...) over that service's procedure
// chips. One tap fills the proposed-procedure field; free text stays
// available next to this picker in each view.
export default function ProcedurePicker({ d, set, customChoices }: Props) {
  const [svc, setSvc] = useState<string>(
    () =>
      SERVICES.find((s) => (customChoices[procKey(s)] ?? []).includes(d.proposedProcedure)) ??
      'Ortho',
  );
  const list = customChoices[procKey(svc)] ?? [];

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
              className={`chip${d.proposedProcedure === label ? ' on' : ''}`}
              onClick={() =>
                set('proposedProcedure', d.proposedProcedure === label ? '' : label)
              }
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="ihint">No {svc} procedures yet &mdash; add them on the Edit Choices tab.</p>
      )}
    </div>
  );
}

import { useState } from 'react';
import { numPad, timePad } from './inputProps';
import LearnedInput from './LearnedInput';
import { learned } from './learned';

// Give a drug mid-case without hunting the grid: pick it, pick the dose, and
// it lands on the right row at the right time column. The commons are one tap;
// anything else is typed once and remembered. Time is now unless another time
// is put in — charting runs behind the clock as often as not.

export interface CommonDrug {
  name: string;
  doses: string[];
  unit: string;
}

// The drugs that get drawn up mid-case, with their usual bolus doses. The
// first three of each list match the chips the wizards already offer.
export const COMMON_DRUGS: CommonDrug[] = [
  { name: 'Phenylephrine', doses: ['.05', '.1', '.2'], unit: 'mg' },
  { name: 'Ephedrine', doses: ['5', '10'], unit: 'mg' },
  { name: 'Sugammadex', doses: ['200', '400'], unit: 'mg' },
  { name: 'Zofran', doses: ['4'], unit: 'mg' },
  { name: 'Decadron', doses: ['4', '8', '10'], unit: 'mg' },
];

interface Props {
  /** Where the dose would land, e.g. "NEO IV mg row at 1015" — for the preview line. */
  describe: (name: string, time: string) => string;
  onGive: (name: string, dose: string, time: string) => void;
  onClose: () => void;
}

export default function QuickDrug({ describe, onGive, onClose }: Props) {
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [time, setTime] = useState(''); // '' = now
  const common = COMMON_DRUGS.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  // Typed drugs from earlier cases, minus the ones already on the common row.
  const remembered = learned('medRow')
    .filter((v) => !COMMON_DRUGS.some((c) => c.name.toLowerCase() === v.toLowerCase()))
    .slice(0, 6);

  const ready = name.trim() !== '' && dose.trim() !== '';

  return (
    <div className="sigpad-backdrop" onClick={onClose}>
      <div className="qd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qd-title">💉 Drug / adjunct</div>

        <div className="igroup">
          <span>Drug</span>
          <div className="chips wrap">
            {COMMON_DRUGS.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`chip${common?.name === c.name ? ' on' : ''}`}
                onClick={() => {
                  setName(common?.name === c.name ? '' : c.name);
                  setDose('');
                }}
              >
                {c.name}
              </button>
            ))}
            {remembered.map((v) => (
              <button
                key={v}
                type="button"
                className={`chip${name === v ? ' on' : ''}`}
                onClick={() => setName(name === v ? '' : v)}
              >
                {v}
              </button>
            ))}
          </div>
          <LearnedInput bucket="medRow" className="qd-input" placeholder="or type a drug…" value={common ? '' : name} onChange={setName} />
        </div>

        <div className="igroup">
          <span>Dose{common ? ` (${common.unit})` : ''}</span>
          <div className="chips wrap">
            {(common?.doses ?? []).map((dv) => (
              <button
                key={dv}
                type="button"
                className={`chip${dose === dv ? ' on' : ''}`}
                onClick={() => setDose(dose === dv ? '' : dv)}
              >
                {dv}
              </button>
            ))}
            <input {...numPad} className="qd-input qd-dose" placeholder="dose" value={dose} onChange={(e) => setDose(e.target.value)} />
          </div>
        </div>

        <div className="igroup">
          <span>Time</span>
          <div className="chips wrap">
            <button type="button" className={`chip${time === '' ? ' on' : ''}`} onClick={() => setTime('')}>
              🕐 Now
            </button>
            <input {...timePad} className="qd-input qd-dose" placeholder="HHMM" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        {ready && <p className="qd-preview">→ {describe(name.trim(), time)}</p>}

        <div className="qd-actions">
          <button type="button" className="chip" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="chip on qd-give"
            disabled={!ready}
            onClick={() => {
              onGive(name.trim(), dose.trim(), time.trim());
              onClose();
            }}
          >
            ✓ Chart it
          </button>
        </div>
      </div>
    </div>
  );
}

import { noAuto } from './inputProps';
import { nowStamp } from './signer';

// Date/time entry that avoids typing: a "Now" stamp button plus scroll
// wheels for date, hour, and minute. Value is stored as "MM/DD/YY HHMM" to
// match the paper forms. Any text can still be typed for odd cases.

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Split "MM/DD/YY HHMM" into its parts, defaulting to now.
function parts(value: string): { date: string; hh: string; mm: string } {
  const m = value.trim().match(/^(\d{2}\/\d{2}\/\d{2})?\s*(\d{2})(\d{2})?$/);
  const now = nowStamp();
  if (m) return { date: m[1] ?? now.date, hh: m[2] ?? now.time.slice(0, 2), mm: m[3] ?? now.time.slice(2) };
  const dm = value.trim().match(/^(\d{2}\/\d{2}\/\d{2})/);
  return { date: dm?.[1] ?? now.date, hh: now.time.slice(0, 2), mm: now.time.slice(2) };
}

// Today and the surrounding days, so a late note can be dated yesterday.
function dayOptions(): string[] {
  const out: string[] = [];
  const base = new Date();
  for (let off = -3; off <= 1; off++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + off);
    out.push(`${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(-2)}`);
  }
  return out;
}

export default function DateTimeField({ value, onChange }: Props) {
  const p = parts(value);
  const days = dayOptions();
  const dayList = days.includes(p.date) ? days : [p.date, ...days];

  const emit = (date: string, hh: string, mm: string) => onChange(`${date} ${hh}${mm}`);

  return (
    <div className="dtf">
      <div className="chips wrap">
        <button
          type="button"
          className="chip on"
          onClick={() => {
            const { date, time } = nowStamp();
            onChange(`${date} ${time}`);
          }}
        >
          🕐 Now
        </button>
        {value && (
          <button type="button" className="chip" onClick={() => onChange('')}>Clear</button>
        )}
      </div>
      <div className="dtf-wheels">
        <label className="dtf-wheel">
          <span>Date</span>
          <select value={p.date} onChange={(e) => emit(e.target.value, p.hh, p.mm)}>
            {dayList.map((d, i) => (
              <option key={d} value={d}>
                {d}{d === days[days.length - 2] ? ' (today)' : i === dayList.length - 1 && d === days[days.length - 1] ? ' (tomorrow)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="dtf-wheel">
          <span>Hour</span>
          <select value={p.hh} onChange={(e) => emit(p.date, e.target.value, p.mm)}>
            {Array.from({ length: 24 }, (_, h) => pad(h)).map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </label>
        <label className="dtf-wheel">
          <span>Min</span>
          <select value={p.mm} onChange={(e) => emit(p.date, p.hh, e.target.value)}>
            {Array.from({ length: 60 }, (_, m) => pad(m)).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="ifield">
        <span>or type</span>
        <input {...noAuto} value={value} placeholder="MM/DD/YY HHMM" onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

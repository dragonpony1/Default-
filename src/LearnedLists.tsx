import { useState } from 'react';
import { BUCKET_LABELS, forget, forgetBucket, learned, type Bucket } from './learned';

// What the app has picked up from being used: the surgeons, procedures,
// diagnoses and added drugs typed into the forms. Shown here so a name that
// went in wrong can be taken out again — nothing else prunes the list.

const BUCKETS = Object.keys(BUCKET_LABELS) as Bucket[];

export default function LearnedLists() {
  // Bumped on every removal so the lists re-read from storage.
  const [tick, setTick] = useState(0);
  const lists = BUCKETS.map((b) => [b, learned(b)] as const);
  const total = lists.reduce((n, [, l]) => n + l.length, 0);
  void tick;

  return (
    <section className="icard">
      <h2>Remembered entries</h2>
      <p className="fbf-hint">
        Typed once, offered back. As you fill in a surgeon, a procedure, a diagnosis or the drug on
        an added med row, the box remembers it and suggests it next time &mdash; tap the box and the
        list drops down. All on this device, and none of it patient data. Tap an entry to forget it.
      </p>
      {total === 0 && <p className="fbf-hint">Nothing remembered yet.</p>}
      {lists.map(([bucket, list]) =>
        list.length ? (
          <div className="lrn-group" key={bucket}>
            <div className="lrn-head">
              <span className="lrn-title">{BUCKET_LABELS[bucket]}</span>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  if (!window.confirm(`Forget all ${list.length} remembered ${BUCKET_LABELS[bucket].toLowerCase()}?`)) return;
                  forgetBucket(bucket);
                  setTick((t) => t + 1);
                }}
              >
                Forget all
              </button>
            </div>
            <div className="chips wrap">
              {list.map((v) => (
                <button
                  type="button"
                  className="chip on"
                  key={v}
                  title="Tap to forget"
                  onClick={() => {
                    forget(bucket, v);
                    setTick((t) => t + 1);
                  }}
                >
                  {v} ✕
                </button>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </section>
  );
}

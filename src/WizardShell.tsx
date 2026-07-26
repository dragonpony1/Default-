import { useState, type ReactNode } from 'react';

// Shared chrome for the guided wizards (record / PACU / billing): a small
// left-flush section jump-nav, a progress bar, the current section card, and
// Back/Next. Each wizard supplies its own steps; this keeps them consistent.

export interface WizStep {
  title: string;
  nav?: string; // short label for the jump-nav
  hint?: string;
  render: () => ReactNode;
}

interface Props {
  steps: WizStep[];
  onBack: () => void; // back to the full form
  onDone: () => void;
  backLabel?: string;
  doneLabel?: string;
}

export default function WizardShell({
  steps,
  onBack,
  onDone,
  backLabel = '← Back to full form',
  doneLabel = 'Done — go to form',
}: Props) {
  const [step, setStep] = useState(0);
  const cur = steps[step];

  return (
    <>
      <div className="awiz-switch screen-only">
        <button type="button" className="chip on" onClick={onBack}>{backLabel}</button>
      </div>
      <div className="intake screen-only awiz">
        <div className="awiz-top">
          <div className="awiz-secnav">
            {steps.map((s, i) => (
              <button
                key={s.title}
                type="button"
                className={`awiz-secbtn${i === step ? ' on' : ''}`}
                onClick={() => setStep(i)}
                title={s.title}
              >
                {s.nav ?? s.title}
              </button>
            ))}
          </div>
          <div className="awiz-progress">
            <div className="fbf-bar"><div className="fbf-fill" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
            <span className="fbf-count">{step + 1} of {steps.length}</span>
          </div>
        </div>

        <section className="icard fbf-card">
          {cur.hint && <p className="fbf-hint">{cur.hint}</p>}
          <h2>{cur.title}</h2>
          {cur.render()}
        </section>

        <div className="fbf-nav">
          <button type="button" className="fbf-back" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            ← Back
          </button>
          {step < steps.length - 1 ? (
            <button type="button" className="fbf-next" onClick={() => setStep((s) => s + 1)}>Next →</button>
          ) : (
            <button type="button" className="fbf-next" onClick={onDone}>{doneLabel}</button>
          )}
        </div>
      </div>
    </>
  );
}

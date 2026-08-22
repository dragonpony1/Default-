import { useState } from 'react';
import { loadProviders, type ProviderProfile } from './providers';
import { useSigner } from './signer';
import { ANES_KEY, BILLING_KEY, BLOCK_KEY, PACU_KEY, readSheet } from './drafts';
import { useCaseData, setCaseField } from './caseData';
import type { PreopEval } from './types';

// The front door. Two questions in big type — who are you, what's the
// assignment — then a checklist of the case with one obvious next step.
// Purely a layer over the existing tabs: it reads the same drafts and flags,
// and every button lands on a screen that already existed.

export type HomeTarget = 'fields' | 'anes' | 'block' | 'proc' | 'pacu' | 'billing' | 'print';

// One color per sheet, used the same way everywhere — tab, checklist row,
// and the next-step buttons — so "the blue one" always means the pre-op.
export const SHEET_CLASS: Record<HomeTarget, string> = {
  fields: 'preop',
  anes: 'record',
  block: 'block',
  proc: 'proc',
  pacu: 'pacu',
  billing: 'billing',
  print: 'print',
};

interface Props {
  d: PreopEval;
  endoDay: boolean;
  setEndoDay: (v: boolean) => void;
  onClickIn: (p: ProviderProfile) => void;
  onGo: (t: HomeTarget) => void;
}

// What "done" means per sheet: its signature (billing: a code marked or the
// sheet signed). Loose on purpose — the pre-print check is the strict gate.
export function sheetStatus(d: PreopEval, endoDay: boolean, blockCase: boolean) {
  const pacu = readSheet(PACU_KEY);
  const anes = readSheet(ANES_KEY);
  const billing = readSheet(BILLING_KEY);
  const block = readSheet(BLOCK_KEY);
  return {
    preop: !!d.evalSig,
    record: endoDay ? null : !!anes.tx.sigImg,
    block: blockCase ? !!block.tx.sigImg : null,
    pacu: !!pacu.tx.sigImg,
    billing: Object.values(billing.ck).some(Boolean) || !!(billing.tx.addCode ?? '').trim(),
  };
}

/** The one thing to do next, for the big button. */
export function nextStep(d: PreopEval, endoDay: boolean, blockCase: boolean, signedIn: boolean):
  { label: string; target: HomeTarget } {
  const s = sheetStatus(d, endoDay, blockCase);
  if (!s.preop) return { label: signedIn ? '▶ Fill out the pre-op' : '▶ Start here: fill out the pre-op', target: 'fields' };
  if (s.record === false) return { label: '▶ Chart the case — anesthesia record', target: 'anes' };
  if (s.block === false) return { label: '▶ Finish the block sheet', target: 'block' };
  if (!s.pacu) return { label: '▶ Sign the PACU orders', target: 'pacu' };
  if (!s.billing) return { label: '▶ Mark the billing code', target: 'billing' };
  return { label: '🖨 Check for blanks and print', target: 'print' };
}

export default function Home({ d, endoDay, setEndoDay, onClickIn, onGo }: Props) {
  const signer = useSigner();
  const caseData = useCaseData();
  const [list] = useState<ProviderProfile[]>(loadProviders);
  const s = sheetStatus(d, endoDay, caseData.blockCase);
  const next = nextStep(d, endoDay, caseData.blockCase, !!signer.initials);

  const row = (label: string, done: boolean | null, target: HomeTarget) =>
    done === null ? null : (
      <button
        type="button"
        className={`home-row hr-${SHEET_CLASS[target]}`}
        key={label}
        onClick={() => onGo(target)}
      >
        <span className={`home-tick${done ? ' on' : ''}`}>{done ? '✓' : '○'}</span>
        <span>{label}</span>
        <span className="home-go">{done ? 'done' : 'open ›'}</span>
      </button>
    );

  return (
    <section className="home screen-only">
      <div className="home-block">
        <h2>Who are you?</h2>
        <p className="home-hint">
          Tap your initials — your signature and your usual choices load, and
          nothing already charted on this tablet is changed.
        </p>
        <div className="home-provs">
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`home-prov${signer.initials === p.initials ? ' on' : ''}`}
              onClick={() => onClickIn(p)}
            >
              {p.initials}
            </button>
          ))}
        </div>
        {signer.initials && (
          <p className="home-hint">✓ Clicked in as <b>{signer.name || signer.initials}</b>.</p>
        )}
      </div>

      <div className="home-block">
        <h2>What&rsquo;s the assignment?</h2>
        <div className="home-cards">
          <button
            type="button"
            className={`home-card${!endoDay ? ' on' : ''}`}
            onClick={() => setEndoDay(false)}
          >
            🏥 OR cases
            <small>Pre-op, record, PACU, billing — 4 pages</small>
          </button>
          <button
            type="button"
            className={`home-card${endoDay ? ' on' : ''}`}
            onClick={() => setEndoDay(true)}
          >
            🔬 Endoscopy day
            <small>No record sheet — the endo nurse charts vitals. 3 pages</small>
          </button>
          <button type="button" className="home-card" onClick={() => onGo('proc')}>
            💉 Called in for a procedure
            <small>LP, blood patch, intubation — a note and the billing</small>
          </button>
        </div>
        {!endoDay && (
          <button
            type="button"
            className={`chip${caseData.blockCase ? ' on' : ''}`}
            onClick={() => setCaseField('blockCase', !caseData.blockCase)}
          >
            🦵 This case has a nerve block{caseData.blockCase ? ' ✓' : ''}
          </button>
        )}
      </div>

      <div className="home-block">
        <h2>The case</h2>
        <div className="home-list">
          {row('Pre-op evaluation', s.preop, 'fields')}
          {row('Anesthesia record', s.record, 'anes')}
          {row('Block sheet', s.block, 'block')}
          {row('PACU orders', s.pacu, 'pacu')}
          {row('Billing sheet', s.billing, 'billing')}
        </div>
        <button
          type="button"
          className={`home-next nx-${SHEET_CLASS[next.target]}`}
          onClick={() => onGo(next.target)}
        >
          {next.label}
        </button>
      </div>
    </section>
  );
}

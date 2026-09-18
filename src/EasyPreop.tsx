import { useState } from 'react';
import type { PreopEval, YesNo } from './types';
import { SYSTEMS, screenItems, selectedProblems, effectiveWnl } from './formConfig';
import type { CustomChoices } from './choices';
import { noAuto, npoPad, numPad, tempPad } from './inputProps';
import ProcedurePicker from './ProcedurePicker';
import LearnedInput from './LearnedInput';
import MedList from './MedList';
import AllergyList from './AllergyList';
import PrevHxList from './PrevHxList';
import SignaturePad from './SignaturePad';
import SigImg from './SigImg';
import { nowStamp, useSigner } from './signer';
import { nameForSignature } from './providers';

// Easy Mode pre-op: the same evaluation as the full wizard, reimagined as a
// short interview — one question per screen, giant type, the likely answer
// one tap away, and a "basically healthy" fast lane that charts the whole
// history by exception. Writes the same draft as every other pre-op screen;
// nothing else in the app changes.

interface Props {
  d: PreopEval;
  set: <K extends keyof PreopEval>(k: K, v: PreopEval[K]) => void;
  customChoices: CustomChoices;
  onExit: () => void;
  onDone: () => void;
}

type StringKeys = { [K in keyof PreopEval]: PreopEval[K] extends string ? K : never }[keyof PreopEval];

// Screen ids in interview order. Review can jump anywhere by id.
const SCREENS = [
  'op', 'dx', 'who', 'body', 'vitals', 'npo',
  'hist', 'sys', 'meds', 'allergy', 'prev', 'family', 'airway', 'habits', 'asa',
  'review', 'sign',
] as const;
type ScreenId = (typeof SCREENS)[number];

export default function EasyPreop({ d, set, customChoices, onExit, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const [openSys, setOpenSys] = useState<string | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const signer = useSigner();
  const id: ScreenId = SCREENS[idx];
  const go = (target: ScreenId) => setIdx(SCREENS.indexOf(target));
  const next = () => setIdx((i) => Math.min(i + 1, SCREENS.length - 1));
  const back = () => setIdx((i) => Math.max(i - 1, 0));

  const blank = (k: StringKeys) => !(d[k] ?? '').trim();

  // The fast lane: everything history-shaped goes Normal in one tap — blanks
  // only, a None never lands over a listed med or allergy — then straight to
  // the review, where the exceptions get charted.
  const healthy = () => {
    if (blank('mallampati')) set('mallampati', 'I');
    if (blank('tmd')) set('tmd', '3');
    if (blank('rom')) set('rom', 'Full');
    if (!d.tobacco) set('tobacco', 'no');
    if (!d.ethanol) set('ethanol', 'no');
    if (!d.streetDrug) set('streetDrug', 'no');
    if (!d.meds.length && blank('currentMedications')) set('currentMedicationsNone', true);
    if (!d.allergyList.length && blank('allergies')) set('allergiesNone', true);
    if (!d.prevHxList.length && blank('previousAnesthesia')) set('previousAnesthesiaNone', true);
    if (blank('familyHistory')) set('familyHistoryNone', true);
    if (!d.physicalStatus) set('physicalStatus', '1');
    go('review');
  };

  const big = (active: boolean, onClick: () => void, label: string, key?: string) => (
    <button key={key ?? label} type="button" className={`ez-choice${active ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );

  const yn = (k: 'tobacco' | 'ethanol' | 'streetDrug', label: string, detail?: StringKeys, ph = '') => (
    <div className="ez-ynrow" key={k}>
      <span className="ez-ynlabel">{label}</span>
      {(['no', 'yes'] as YesNo[]).map((v) =>
        big(d[k] === v, () => set(k, d[k] === v ? '' : v), v === 'yes' ? 'Yes' : 'No', k + v),
      )}
      {detail && d[k] === 'yes' && (
        <input {...noAuto} className="ez-input ez-detail" placeholder={ph} value={d[detail]} onChange={(e) => set(detail, e.target.value)} />
      )}
    </div>
  );

  const noneScreen = (
    title: string,
    noneLabel: string,
    noneKey: 'currentMedicationsNone' | 'allergiesNone' | 'previousAnesthesiaNone' | 'familyHistoryNone',
    listEmpty: boolean,
    body: React.ReactNode,
  ) => (
    <>
      <h1 className="ez-q">{title}</h1>
      {listEmpty && big(d[noneKey], () => set(noneKey, !d[noneKey]), noneLabel, noneKey)}
      {!d[noneKey] && <div className="ez-body">{body}</div>}
    </>
  );

  const problems = selectedProblems(d.checks, d.customConditions, d.checkDetails);

  const summaryOf: Partial<Record<ScreenId, string>> = {
    op: d.proposedProcedure,
    dx: d.surgicalDx,
    who: [d.age && `${d.age} y`, d.sex].filter(Boolean).join(' · '),
    body: [d.height && `${d.height}″`, d.weight && `${d.weight} ${d.weightUnit || 'lb'}`].filter(Boolean).join(' · '),
    vitals: [d.bp, d.p && `P ${d.p}`, d.r && `R ${d.r}`, d.t && `T ${d.t}`].filter(Boolean).join(', '),
    npo: d.npo,
    sys: problems.length ? problems.join('; ') : 'All systems normal',
    meds: d.currentMedicationsNone ? 'None' : [...d.meds.map((m) => m.name), d.currentMedications].filter(Boolean).join(', '),
    allergy: d.allergiesNone ? 'NKDA' : [...d.allergyList.map((a) => a.name), d.allergies].filter(Boolean).join(', '),
    prev: d.previousAnesthesiaNone ? 'None' : [...d.prevHxList.map((p) => p.name), d.previousAnesthesia].filter(Boolean).join(', '),
    family: d.familyHistoryNone ? 'None' : d.familyHistory,
    airway: [d.mallampati && `Mallampati ${d.mallampati}`, d.tmd && `TMD ${d.tmd}`, d.rom].filter(Boolean).join(' · '),
    habits: [d.tobacco && `Tobacco ${d.tobacco}`, d.ethanol && `EtOH ${d.ethanol}`, d.streetDrug && `Drugs ${d.streetDrug}`]
      .filter(Boolean).join(' · '),
    asa: d.physicalStatus ? `ASA ${d.physicalStatus}${d.physicalStatusE ? 'E' : ''}` : '',
  };

  const stampSig = (sig: string) => {
    const { date, time } = nowStamp();
    set('evalSig', sig);
    set('evalDateTime', `${date} ${time}`);
    set('evalSigName', signer.name || signer.initials);
  };

  const [sys = '', dia = ''] = d.bp.split('/');
  const writeBp = (s: string, dv: string) => set('bp', dv ? `${s}/${dv}` : s);

  const screen = (): React.ReactNode => {
    switch (id) {
      case 'op':
        return (
          <>
            <h1 className="ez-q">What&rsquo;s the operation?</h1>
            <ProcedurePicker d={d} set={set} customChoices={customChoices} />
            <LearnedInput bucket="procedure" className="ez-input" value={d.proposedProcedure} placeholder="or type it" onChange={(v) => set('proposedProcedure', v)} />
          </>
        );
      case 'dx':
        return (
          <>
            <h1 className="ez-q">Why? (surgical diagnosis)</h1>
            <LearnedInput bucket="diagnosis" className="ez-input" value={d.surgicalDx} placeholder="e.g. cholelithiasis" onChange={(v) => set('surgicalDx', v)} />
          </>
        );
      case 'who':
        return (
          <>
            <h1 className="ez-q">Who&rsquo;s the patient?</h1>
            <label className="ez-field"><span>Age</span>
              <input {...numPad} className="ez-input ez-short" value={d.age} onChange={(e) => set('age', e.target.value)} />
            </label>
            <div className="ez-choices">
              {(['M', 'F'] as const).map((v) => big(d.sex === v, () => set('sex', d.sex === v ? '' : v), v === 'M' ? 'Male' : 'Female', v))}
            </div>
          </>
        );
      case 'body':
        return (
          <>
            <h1 className="ez-q">Height &amp; weight</h1>
            <div className="chips wrap">
              {[62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75].map((n) => (
                <button key={n} type="button" className={`chip${d.height === String(n) ? ' on' : ''}`}
                  onClick={() => { set('height', d.height === String(n) ? '' : String(n)); set('heightUnit', 'in'); }}>
                  {n}″
                </button>
              ))}
            </div>
            <label className="ez-field"><span>Weight (lb)</span>
              <input {...numPad} className="ez-input ez-short" value={d.weight} onChange={(e) => { set('weight', e.target.value); if (!d.weightUnit) set('weightUnit', 'lb'); }} />
            </label>
          </>
        );
      case 'vitals':
        return (
          <>
            <h1 className="ez-q">Vital signs</h1>
            <p className="ez-hint">Tap the first box and just type — it hops along by itself.</p>
            <div className="ez-vrow">
              <label className="ez-field"><span>BP sys</span>
                <input {...numPad} className="ez-input ez-short" data-vseq="ezBpSys" data-vnext="ezBpDia" placeholder="120" value={sys}
                  onChange={(e) => writeBp(e.target.value.replace(/[^0-9]/g, ''), dia)} /></label>
              <label className="ez-field"><span>dia</span>
                <input {...numPad} className="ez-input ez-short" data-vseq="ezBpDia" data-vnext="ezP" placeholder="80" value={dia}
                  onChange={(e) => writeBp(sys, e.target.value.replace(/[^0-9]/g, ''))} /></label>
              <label className="ez-field"><span>Pulse</span>
                <input {...numPad} className="ez-input ez-short" data-vseq="ezP" data-vnext="ezR" value={d.p} onChange={(e) => set('p', e.target.value)} /></label>
              <label className="ez-field"><span>Resp</span>
                <input {...numPad} className="ez-input ez-short" data-vseq="ezR" data-vnext="" value={d.r} onChange={(e) => set('r', e.target.value)} /></label>
              <label className="ez-field"><span>Temp</span>
                <input {...tempPad} className="ez-input ez-short" value={d.t} onChange={(e) => set('t', e.target.value)} /></label>
            </div>
          </>
        );
      case 'npo':
        return (
          <>
            <h1 className="ez-q">NPO since?</h1>
            <div className="ez-choices">
              {big(d.npo === 'Midnight', () => set('npo', 'Midnight'), '🌙 Midnight')}
            </div>
            <label className="ez-field"><span>or a time</span>
              <input {...npoPad} className="ez-input" value={d.npo} onChange={(e) => set('npo', e.target.value)} />
            </label>
          </>
        );
      case 'hist':
        return (
          <>
            <h1 className="ez-q">Medical history?</h1>
            <div className="ez-stack">
              <button type="button" className="ez-choice ez-healthy" onClick={healthy}>
                🟢 Basically healthy
                <small>No meds, no allergies, no history — everything charts Normal (ASA 1) and you fix anything that isn&rsquo;t on the next screen.</small>
              </button>
              <button type="button" className="ez-choice" onClick={next}>
                📋 Has some history
                <small>Walk through it — only what&rsquo;s abnormal needs a tap.</small>
              </button>
            </div>
          </>
        );
      case 'sys':
        return (
          <>
            <h1 className="ez-q">Anything to note, by system?</h1>
            <p className="ez-hint">Everything is Normal until you tap it. Open a system only if something&rsquo;s there.</p>
            <div className="ez-stack">
              {SYSTEMS.map((s) => {
                const wnl = effectiveWnl(d, s.key);
                const open = openSys === s.key;
                return (
                  <div key={s.key} className="ez-sys">
                    <button type="button" className={`ez-sysrow${wnl ? '' : ' has'}`} onClick={() => setOpenSys(open ? null : s.key)}>
                      <span>{s.title}</span>
                      <span className={`ez-sysstate${wnl ? ' ok' : ''}`}>{wnl ? '✓ Normal' : 'noted'}</span>
                    </button>
                    {open && (
                      <div className="chips wrap ez-syschips">
                        {screenItems(s).map((label) => {
                          const k = `${s.key}:${label}`;
                          const on = !!d.checks[k];
                          return (
                            <span key={k}>
                              <button type="button" className={`chip${on ? ' on' : ''}`}
                                onClick={() => set('checks', { ...d.checks, [k]: !on })}>
                                {label}
                              </button>
                              {on && (
                                <input {...noAuto} className="ez-detail" placeholder="details…" value={d.checkDetails[k] ?? ''}
                                  onChange={(e) => set('checkDetails', { ...d.checkDetails, [k]: e.target.value })} />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      case 'meds':
        return noneScreen('Medications?', '✓ No medications', 'currentMedicationsNone',
          !d.meds.length && blank('currentMedications'),
          <MedList d={d} set={set} customChoices={customChoices} />);
      case 'allergy':
        return noneScreen('Allergies?', '✓ NKDA — no known allergies', 'allergiesNone',
          !d.allergyList.length && blank('allergies'),
          <AllergyList d={d} set={set} customChoices={customChoices} />);
      case 'prev':
        return noneScreen('Previous anesthesia or operations?', '✓ None / no problems', 'previousAnesthesiaNone',
          !d.prevHxList.length && blank('previousAnesthesia'),
          <PrevHxList d={d} set={set} customChoices={customChoices} />);
      case 'family':
        return noneScreen('Family problems with anesthesia?', '✓ None', 'familyHistoryNone',
          blank('familyHistory'),
          <input {...noAuto} className="ez-input" placeholder="who and what" value={d.familyHistory} onChange={(e) => set('familyHistory', e.target.value)} />);
      case 'airway':
        return (
          <>
            <h1 className="ez-q">Airway</h1>
            <div className="ez-ynrow"><span className="ez-ynlabel">Mallampati</span>
              {['I', 'II', 'III', 'IV'].map((v) => big(d.mallampati === v, () => set('mallampati', d.mallampati === v ? '' : v), v, `m${v}`))}
            </div>
            <div className="ez-ynrow"><span className="ez-ynlabel">TMD (FB)</span>
              {['2', '3', '4'].map((v) => big(d.tmd === v, () => set('tmd', d.tmd === v ? '' : v), v, `t${v}`))}
            </div>
            <div className="ez-ynrow"><span className="ez-ynlabel">Neck ROM</span>
              {['Full', 'Limited'].map((v) => big(d.rom === v, () => set('rom', d.rom === v ? '' : v), v, `r${v}`))}
            </div>
          </>
        );
      case 'habits':
        return (
          <>
            <h1 className="ez-q">Tobacco, alcohol, drugs?</h1>
            <div className="ez-choices">
              {big(d.tobacco === 'no' && d.ethanol === 'no' && d.streetDrug === 'no',
                () => { set('tobacco', 'no'); set('ethanol', 'no'); set('streetDrug', 'no'); },
                '✓ No to all')}
            </div>
            {yn('tobacco', 'Tobacco', 'tobaccoPacksDay', 'packs/day')}
            {yn('ethanol', 'Alcohol', 'ethanolFreq', 'how often')}
            {yn('streetDrug', 'Street drugs', 'streetDrugFreq', 'what / how often')}
          </>
        );
      case 'asa':
        return (
          <>
            <h1 className="ez-q">ASA physical status</h1>
            <div className="ez-choices">
              {(['1', '2', '3', '4', '5'] as const).map((v) =>
                big(d.physicalStatus === v, () => set('physicalStatus', d.physicalStatus === v ? '' : v), v, `asa${v}`))}
              {big(d.physicalStatusE, () => set('physicalStatusE', !d.physicalStatusE), 'E — emergency', 'asaE')}
            </div>
          </>
        );
      case 'review': {
        const rows: Array<[ScreenId, string]> = [
          ['op', 'Operation'], ['dx', 'Diagnosis'], ['who', 'Patient'], ['body', 'Height / weight'],
          ['vitals', 'Vitals'], ['npo', 'NPO'], ['sys', 'Problems'], ['meds', 'Medications'],
          ['allergy', 'Allergies'], ['prev', 'Previous anesthesia'], ['family', 'Family history'],
          ['airway', 'Airway'], ['habits', 'Habits'], ['asa', 'ASA'],
        ];
        return (
          <>
            <h1 className="ez-q">Look it over</h1>
            <p className="ez-hint">Tap any line to fix it — that&rsquo;s the charting-by-exception part.</p>
            <div className="ez-stack">
              {rows.map(([rid, label]) => {
                const v = summaryOf[rid] ?? '';
                return (
                  <button key={rid} type="button" className="ez-revrow" onClick={() => go(rid)}>
                    <span className="ez-revlabel">{label}</span>
                    <span className={`ez-revvalue${v ? '' : ' empty'}`}>{v || '— blank —'}</span>
                  </button>
                );
              })}
            </div>
          </>
        );
      }
      case 'sign':
        return (
          <>
            <h1 className="ez-q">Sign it</h1>
            {d.evalSig && (
              <div className="ez-signed">
                <SigImg src={d.evalSig} />
                {nameForSignature(d.evalSig, d.evalSigName) && <span className="signame">{nameForSignature(d.evalSig, d.evalSigName)}</span>}
              </div>
            )}
            <div className="ez-choices">
              <button type="button" className="ez-choice on"
                onClick={() => (signer.signature ? stampSig(signer.signature) : setPadOpen(true))}>
                {d.evalSig ? '↻ Re-sign' : signer.signature ? `✍ Sign as ${signer.name || signer.initials}` : '✍ Sign'}
              </button>
            </div>
            {padOpen && (
              <SignaturePad onSave={(sig) => { stampSig(sig); setPadOpen(false); }} onCancel={() => setPadOpen(false)} />
            )}
          </>
        );
      default:
        return null;
    }
  };

  const last = id === 'sign';
  return (
    <div className="ez screen-only">
      <div className="ez-head">
        <button type="button" className="chip" onClick={back} disabled={idx === 0}>← Back</button>
        <span className="ez-count">{idx + 1} of {SCREENS.length}</span>
        <button type="button" className="chip" onClick={onExit}>✕ Exit</button>
      </div>
      <div className="ez-card">{screen()}</div>
      <button
        type="button"
        className="ez-next"
        onClick={() => {
          if (last) onDone();
          else next();
        }}
      >
        {last ? (d.evalSig ? '✓ Done — hand the tablet on' : 'Done (not signed yet)') : id === 'review' ? 'Looks right → Sign it' : 'Next →'}
      </button>
    </div>
  );
}

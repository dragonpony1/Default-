import { useState, type ReactNode } from 'react';
import { noAuto, numPad, timePad } from './inputProps';
import WizardShell, { type WizStep } from './WizardShell';
import SigImg from './SigImg';
import SignaturePad from './SignaturePad';
import { nameForSignature } from './providers';
import { nowStamp, useSigner } from './signer';

// Guided walk-through of the Block Documentation sheet — fills the same
// draft, made for a phone in the OR right after the block goes in. Everything
// is a tap: side, site, doses, the (+/–) findings, and the signature.

export interface BlockWizApi {
  ck: Record<string, boolean>;
  tx: Record<string, string>;
  setCk: (k: string, v: boolean) => void;
  setTx: (k: string, v: string) => void;
  onBack: () => void;
  onDone: () => void;
}

const SITES = [
  ['interscalene', 'Interscalene'],
  ['axillaryBlk', 'Axillary'],
  ['femoral', 'Femoral'],
  ['sciatic', 'Sciatic'],
  ['infraclavicular', 'Infraclavicular'],
  ['supraclavicular', 'Supraclavicular'],
  ['popliteal', 'Popliteal'],
  ['contFnb', 'Cont FNB'],
] as const;

export default function BlockWizard(api: BlockWizApi) {
  const signer = useSigner();
  const [padOpen, setPadOpen] = useState(false);

  const chip = (active: boolean, onClick: () => void, label: string, key?: string) => (
    <button key={key ?? label} type="button" className={`chip${active ? ' on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
  const ckChip = (k: string, label: string) => chip(!!api.ck[k], () => api.setCk(k, !api.ck[k]), label, k);
  const xckChip = (k: string, other: string, label: string) =>
    chip(!!api.ck[k], () => {
      const next = !api.ck[k];
      api.setCk(k, next);
      if (next) api.setCk(other, false);
    }, label, k);
  const group = (title: string, children: ReactNode) => (
    <div className="igroup"><span>{title}</span><div className="chips wrap">{children}</div></div>
  );
  const field = (label: string, k: string, kind: 'text' | 'num' | 'time' = 'text', ph = '') => (
    <label className="ifield" key={k}>
      <span>{label}</span>
      <input
        {...(kind === 'time' ? timePad : kind === 'num' ? numPad : noAuto)}
        value={api.tx[k] ?? ''}
        placeholder={ph}
        onChange={(e) => api.setTx(k, e.target.value)}
      />
    </label>
  );
  // Value quick-picks that write a tx field, with a free box for the rest.
  const pick = (title: string, k: string, opts: string[], unit = '') => (
    <div className="igroup" key={k}>
      <span>{title}{unit ? <span className="awiz-unit"> {unit}</span> : null}</span>
      <div className="chips wrap">
        {opts.map((o) => chip(api.tx[k] === o, () => api.setTx(k, api.tx[k] === o ? '' : o), o, k + o))}
        <input {...numPad} className="awiz-doseinput" placeholder="other" value={opts.includes(api.tx[k]) ? '' : (api.tx[k] ?? '')} onChange={(e) => api.setTx(k, e.target.value)} />
      </div>
    </div>
  );
  // The printed (+/–) pair as two chips; one clears the other.
  const pmPair = (k: string, label: string) => (
    <div className="igroup" key={k}>
      <span>{label}</span>
      <div className="chips wrap">
        {chip(!!api.ck[`${k}Pos`], () => { const n = !api.ck[`${k}Pos`]; api.setCk(`${k}Pos`, n); if (n) api.setCk(`${k}Neg`, false); }, '+', `${k}p`)}
        {chip(!!api.ck[`${k}Neg`], () => { const n = !api.ck[`${k}Neg`]; api.setCk(`${k}Neg`, n); if (n) api.setCk(`${k}Pos`, false); }, '–', `${k}n`)}
      </div>
    </div>
  );

  const stampSig = (sig: string) => {
    const { date, time } = nowStamp();
    api.setTx('sigImg', sig);
    api.setTx('sigDate', date);
    api.setTx('sigTime', time);
    api.setTx('sigName', signer.name || signer.initials);
  };

  const steps: WizStep[] = [
    {
      title: 'The block',
      nav: 'Block',
      hint: 'Side, site, why, and when. The stimulator step writes its "at" from what you pick here.',
      render: () => (
        <>
          {group('Side', <>{xckChip('sideRight', 'sideLeft', 'Right')}{xckChip('sideLeft', 'sideRight', 'Left')}</>)}
          {group('Site', <>{SITES.map(([k, label]) => ckChip(k, label))}{ckChip('siteOtherCk', 'Other')}</>)}
          {api.ck.siteOtherCk && field('Other site', 'siteOther')}
          {group('Indication', <>{ckChip('postopPain', 'Post-operative pain')}{ckChip('opAnesthesia', 'Operative Anesthesia')}</>)}
          <div className="irow">
            {field('Block start', 'blockStart', 'time', 'HHMM')}
            {field('Block end', 'blockEnd', 'time', 'HHMM')}
          </div>
        </>
      ),
    },
    {
      title: 'Consent & timeout',
      nav: 'Consent',
      hint: 'The consent line carries the printed risks paragraph with it.',
      render: () => (
        <>
          {group('Checks', (
            <>
              {ckChip('consent', 'Consent — risks & benefits discussed')}
              {ckChip('timeout', 'Time out: patient, procedure, site')}
              {ckChip('safeReview', 'Safe Procedure Review completed')}
            </>
          ))}
          {field('RN present for timeout and procedure', 'rnName', 'text', 'name')}
        </>
      ),
    },
    {
      title: 'Monitors, prep & sedation',
      nav: 'Prep',
      render: () => (
        <>
          {group('Monitors', (
            <>
              {chip(!!(api.ck.ekg && api.ck.spo2 && api.ck.nibp), () => {
                const on = !(api.ck.ekg && api.ck.spo2 && api.ck.nibp);
                ['ekg', 'spo2', 'nibp'].forEach((k) => api.setCk(k, on));
              }, '✓ All three (EKG, SpO₂, NIBP)')}
              {ckChip('ekg', 'EKG')}
              {ckChip('spo2', 'SpO₂')}
              {ckChip('nibp', 'NIBP')}
            </>
          ))}
          {group('Prep', (
            <>
              {ckChip('betadine', 'Betadine')}
              {ckChip('alcohol', 'Alcohol')}
              {ckChip('chlorhexidine', 'Chlorhexidine/Alcohol')}
              {ckChip('duraprep', 'DuraPrep')}
            </>
          ))}
          {group('IV sedation', <>{xckChip('sedNo', 'sedYes', 'No')}{xckChip('sedYes', 'sedNo', 'Yes')}</>)}
          {api.ck.sedYes && pick('Versed', 'versed', ['1', '2'], 'mg')}
          {api.ck.sedYes && pick('Fentanyl', 'fentanylSed', ['50', '100'], 'mcg')}
        </>
      ),
    },
    {
      title: 'Needle & stimulator',
      nav: 'Needle',
      hint: 'The "at" fills itself from the block you picked — R Interscalene, L Femoral — and stays editable.',
      render: () => (
        <>
          {group('Needle (Stimuplex)', (
            <>
              {ckChip('tuohy18', '18-gauge Tuohy 2/4 inch')}
              {ckChip('gauge22', '22-gauge 2/4 inch')}
              {ckChip('needleOtherCk', 'Other')}
            </>
          ))}
          {api.ck.needleOtherCk && field('Other needle', 'needleOther')}
          {pick('Used/minimum current', 'ma1', ['0.2', '0.3', '0.4', '0.5'], 'mA')}
          {field('at', 'maAt1', 'text', 'R Interscalene')}
        </>
      ),
    },
    {
      title: 'Injectate & findings',
      nav: 'Injectate',
      render: () => (
        <>
          {pick('Ropivacaine', 'ropiPct', ['0.2', '0.5'], '%')}
          {pick('Volume', 'ropiVol', ['20', '30'], 'mL')}
          {field('Other injectate', 'injOther')}
          {pmPair('aspiration', 'Aspiration test')}
          {pmPair('testDose', 'Test dose')}
          {pmPair('paresNeedle', 'Paresthesia with needle placement')}
          {pmPair('paresInjection', 'Parasthesia with injection')}
        </>
      ),
    },
    {
      title: 'Catheter',
      nav: 'Catheter',
      hint: 'Single-shot block? Skip straight past this step.',
      render: () => (
        <>
          {group('Catheter', (
            <>
              {ckChip('cathSterile', 'Placed under sterile technique')}
              {ckChip('tunneled', 'Tunneled')}
              {ckChip('steriStrips', 'Secured with Steri-Strips')}
              {ckChip('flushed', 'Flushed and aspirated after securing')}
            </>
          ))}
          {api.ck.cathSterile && field('Inserted to (cm at skin)', 'cathCm', 'num')}
          {api.ck.cathSterile && pmPair('heme', 'Heme')}
          {api.ck.cathSterile && pmPair('ivSymptoms', 'Symptoms of IV injection')}
          {api.ck.cathSterile && pmPair('painInjection', 'Pain on injection')}
          {api.ck.cathSterile && pmPair('paresCatheter', 'Pain/parasthesia with catheter')}
        </>
      ),
    },
    {
      title: 'Sign-off',
      nav: 'Sign-off',
      hint: 'Sign and it stamps the date and time with it.',
      render: () => (
        <>
          <div className="pan-signoff">
            <div className="pan-sigcell">
              <span className="pan-siglabel">Provider Signature</span>
              <div className="pan-sigslot">
                {api.tx.sigImg ? <SigImg src={api.tx.sigImg} /> : <span className="pan-blank" />}
                {api.tx.sigImg && nameForSignature(api.tx.sigImg, api.tx.sigName) && (
                  <span className="signame">{nameForSignature(api.tx.sigImg, api.tx.sigName)}</span>
                )}
              </div>
              <div className="chips">
                <button
                  type="button"
                  className="chip on"
                  onClick={() => (signer.signature ? stampSig(signer.signature) : setPadOpen(true))}
                >
                  {api.tx.sigImg ? '↻ Re-sign' : signer.signature ? `✍ Sign as ${signer.name || signer.initials}` : '✍ Sign'}
                </button>
                {api.tx.sigImg && (
                  <button type="button" className="chip" onClick={() => { api.setTx('sigImg', ''); api.setTx('sigName', ''); }}>Clear</button>
                )}
              </div>
            </div>
          </div>
          {padOpen && (
            <SignaturePad
              onSave={(sig) => {
                stampSig(sig);
                setPadOpen(false);
              }}
              onCancel={() => setPadOpen(false)}
            />
          )}
        </>
      ),
    },
  ];

  return <WizardShell steps={steps} onBack={api.onBack} onDone={api.onDone} />;
}

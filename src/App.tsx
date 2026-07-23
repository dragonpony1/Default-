import { useEffect, useState } from 'react';
import { emptyPreopEval, type PreopEval } from './types';
import { clearDraft, loadDraft, saveDraft } from './storage';

type Field = keyof PreopEval;

export default function App() {
  const [data, setData] = useState<PreopEval>(loadDraft);

  useEffect(() => {
    saveDraft(data);
  }, [data]);

  const set = (field: Field) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const value =
      e.target instanceof HTMLInputElement && e.target.type === 'checkbox'
        ? e.target.checked
        : e.target.value;
    setData((d) => ({ ...d, [field]: value }));
  };

  const handleClear = () => {
    if (window.confirm('Clear the entire form? This removes all entered data from this device.')) {
      clearDraft();
      setData({ ...emptyPreopEval });
    }
  };

  const text = (label: string, field: Field, props: { wide?: boolean; type?: string } = {}) => (
    <label className={`field${props.wide ? ' wide' : ''}`}>
      <span>{label}</span>
      <input type={props.type ?? 'text'} value={String(data[field])} onChange={set(field)} />
    </label>
  );

  const area = (label: string, field: Field, rows = 2) => (
    <label className="field wide">
      <span>{label}</span>
      <textarea rows={rows} value={String(data[field])} onChange={set(field)} />
    </label>
  );

  return (
    <div className="app">
      <header className="toolbar screen-only">
        <h1>Pre-Anesthesia Evaluation</h1>
        <div className="toolbar-actions">
          <button onClick={() => window.print()}>Print</button>
          <button className="danger" onClick={handleClear}>Clear form</button>
        </div>
        <p className="privacy-note">
          All data stays on this device only. Clear the form after printing.
        </p>
      </header>

      <main className="sheet">
        <div className="sheet-header print-only">
          <h2>Pre-Anesthesia Evaluation</h2>
        </div>

        <section>
          <h3>Patient</h3>
          <div className="grid">
            {text('Patient name', 'patientName', { wide: true })}
            {text('MRN', 'mrn')}
            {text('Date of birth', 'dob', { type: 'date' })}
            {text('Age', 'age')}
            {text('Sex', 'sex')}
            {text('Height (cm)', 'heightCm')}
            {text('Weight (kg)', 'weightKg')}
            {text('Date', 'date', { type: 'date' })}
          </div>
        </section>

        <section>
          <h3>Planned Procedure</h3>
          <div className="grid">
            {text('Procedure', 'procedure', { wide: true })}
            {text('Surgeon', 'surgeon')}
            {text('Diagnosis', 'diagnosis', { wide: true })}
          </div>
        </section>

        <section>
          <h3>History</h3>
          <div className="grid">
            {area('Allergies', 'allergies', 1)}
            {area('Current medications', 'medications')}
            {area('Past medical history', 'pastMedicalHistory')}
            {area('Past surgical history', 'pastSurgicalHistory')}
            {area('Prior anesthesia history / complications', 'anesthesiaHistory', 1)}
            {area('Family anesthesia complications', 'familyAnesthesiaHistory', 1)}
            {text('NPO status (last intake)', 'npoStatus', { wide: true })}
          </div>
        </section>

        <section>
          <h3>Review of Systems</h3>
          <div className="grid">
            {area('Cardiac', 'cardiac', 1)}
            {area('Pulmonary', 'pulmonary', 1)}
            {area('Renal', 'renal', 1)}
            {area('Hepatic / GI', 'hepaticGI', 1)}
            {area('Neuro', 'neuro', 1)}
            {area('Endocrine', 'endocrine', 1)}
            {area('Other', 'other', 1)}
          </div>
        </section>

        <section>
          <h3>Airway Exam</h3>
          <div className="grid">
            <label className="field">
              <span>Mallampati class</span>
              <select value={data.mallampati} onChange={set('mallampati')}>
                <option value="">—</option>
                <option>I</option>
                <option>II</option>
                <option>III</option>
                <option>IV</option>
              </select>
            </label>
            {text('Thyromental distance', 'thyromentalDistance')}
            {text('Mouth opening', 'mouthOpening')}
            {text('Neck ROM', 'neckROM')}
            {text('Dentition', 'dentition')}
            {area('Airway notes', 'airwayNotes', 1)}
          </div>
        </section>

        <section>
          <h3>Physical Exam / Vitals</h3>
          <div className="grid">
            {text('BP', 'bp')}
            {text('HR', 'hr')}
            {text('RR', 'rr')}
            {text('SpO₂', 'spo2')}
            {text('Temp', 'temp')}
            {area('Heart', 'heartExam', 1)}
            {area('Lungs', 'lungExam', 1)}
          </div>
        </section>

        <section>
          <h3>Labs / Studies</h3>
          <div className="grid">
            {area('Labs', 'labs', 1)}
            {area('EKG', 'ekg', 1)}
            {area('Imaging', 'imaging', 1)}
          </div>
        </section>

        <section>
          <h3>Assessment &amp; Plan</h3>
          <div className="grid">
            <label className="field">
              <span>ASA class</span>
              <select value={data.asaClass} onChange={set('asaClass')}>
                <option value="">—</option>
                <option>I</option>
                <option>II</option>
                <option>III</option>
                <option>IV</option>
                <option>V</option>
                <option>VI</option>
              </select>
            </label>
            <label className="field checkbox">
              <input type="checkbox" checked={data.asaEmergency} onChange={set('asaEmergency')} />
              <span>Emergency (E)</span>
            </label>
            {area('Anesthetic plan', 'anestheticPlan')}
            {area('Notes', 'assessmentNotes')}
          </div>
        </section>

        <section>
          <h3>Provider</h3>
          <div className="grid">
            {text('Provider name', 'providerName', { wide: true })}
            {text('Date / time of evaluation', 'evalDateTime')}
            <div className="field wide signature">
              <span>Signature</span>
              <div className="signature-line" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

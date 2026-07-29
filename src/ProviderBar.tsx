import { useState } from 'react';
import {
  loadProviders,
  saveProviders,
  captureCurrentPrefs,
  type ProviderProfile,
  type ProviderPrefs,
} from './providers';
import { setSigner } from './signer';
import SignaturePad from './SignaturePad';

// A row of provider buttons (by initials) on the front GUI. Tap a provider to
// "click in" — their saved standing choices populate the forms. Add a provider
// to capture your current setup as that provider's defaults; Save updates them.
// No patient data is involved — provider preferences only.

interface Props {
  onApply: (prefs: ProviderPrefs) => void;
}

function newId(existing: ProviderProfile[]): string {
  // Avoid Date.now/Math.random; derive a stable-enough id from the set.
  let n = existing.length + 1;
  const ids = new Set(existing.map((p) => p.id));
  while (ids.has(`p${n}`)) n += 1;
  return `p${n}`;
}

export default function ProviderBar({ onApply }: Props) {
  const [list, setList] = useState<ProviderProfile[]>(loadProviders);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [padOpen, setPadOpen] = useState(false);

  const persist = (next: ProviderProfile[]) => {
    saveProviders(next);
    setList(next);
  };

  const addProvider = () => {
    const raw = window.prompt('New provider initials (e.g. ABC):');
    const initials = (raw ?? '').trim().toUpperCase();
    if (!initials) return;
    // The full name is what appears on the record's signature lines; the
    // initials stay the button label.
    const name = (window.prompt(`Full name for ${initials} (as it should read on the record):`) ?? '').trim();
    const profile: ProviderProfile = {
      id: newId(list),
      initials,
      prefs: { ...captureCurrentPrefs(initials), providerName: name || initials },
    };
    persist([...list, profile]);
    setActiveId(profile.id);
    // Adding yourself is also clicking in — otherwise the signature lines stay
    // blank until you tap your own chip again.
    setSigner({ initials, name: name || initials, signature: '' });
    window.alert(`Saved current choices as ${initials}'s defaults.`);
  };

  const clickIn = (p: ProviderProfile) => {
    setActiveId(p.id);
    setSigner({ initials: p.initials, name: p.prefs.providerName ?? '', signature: p.signature ?? '' });
    onApply(p.prefs);
  };

  const saveSignature = (dataUrl: string) => {
    const p = list.find((x) => x.id === activeId);
    if (!p) return;
    const next = list.map((x) => (x.id === p.id ? { ...x, signature: dataUrl } : x));
    persist(next);
    setSigner({ initials: p.initials, name: p.prefs.providerName ?? '', signature: dataUrl });
    setPadOpen(false);
  };

  const saveActive = () => {
    const p = list.find((x) => x.id === activeId);
    if (!p) return;
    const next = list.map((x) =>
      x.id === p.id ? { ...x, prefs: captureCurrentPrefs(x.initials) } : x,
    );
    persist(next);
    window.alert(`Updated ${p.initials}'s defaults from the current forms.`);
  };

  // The name shown on signature lines, editable after the fact.
  const renameActive = () => {
    const p = list.find((x) => x.id === activeId);
    if (!p) return;
    const name = window.prompt(`Full name for ${p.initials}:`, p.prefs.providerName ?? '');
    if (name == null) return;
    const next = list.map((x) =>
      x.id === p.id ? { ...x, prefs: { ...x.prefs, providerName: name.trim() } } : x,
    );
    persist(next);
    setSigner({ initials: p.initials, name: name.trim(), signature: p.signature ?? '' });
  };

  const removeActive = () => {
    const p = list.find((x) => x.id === activeId);
    if (!p) return;
    if (!window.confirm(`Remove provider ${p.initials}? Their saved defaults are deleted.`)) return;
    persist(list.filter((x) => x.id !== p.id));
    setActiveId(null);
  };

  const active = list.find((x) => x.id === activeId) ?? null;

  return (
    <div className="provbar screen-only">
      <span className="provbar-label">Provider:</span>
      {list.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`chip prov-chip${p.id === activeId ? ' on' : ''}`}
          onClick={() => clickIn(p)}
          title={`Click in as ${p.initials} — loads their usual choices`}
        >
          {p.initials}
        </button>
      ))}
      <button type="button" className="chip prov-add" onClick={addProvider}>
        ＋ Add
      </button>
      {active && (
        <>
          <button type="button" className="chip prov-save" onClick={saveActive}>
            💾 Save {active.initials}'s defaults
          </button>
          <button type="button" className="chip prov-sig" onClick={() => setPadOpen(true)}>
            ✍ {active.signature ? 'Update' : 'Add'} signature
          </button>
          <button type="button" className="chip prov-name" onClick={renameActive}>
            🏷 {active.prefs.providerName || 'Set name'}
          </button>
          <button type="button" className="chip prov-remove" onClick={removeActive} aria-label="Remove provider">
            ✕
          </button>
        </>
      )}
      {padOpen && active && (
        <SignaturePad initial={active.signature} onSave={saveSignature} onCancel={() => setPadOpen(false)} />
      )}
    </div>
  );
}

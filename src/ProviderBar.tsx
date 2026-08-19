import { useState } from 'react';
import {
  loadProviders,
  saveProviders,
  captureCurrentPrefs,
  variantPrefs,
  TECHNIQUES,
  type ProviderProfile,
  type ProviderPrefs,
  type TechniqueKey,
} from './providers';
import { getSigner, setSigner } from './signer';
import SignaturePad from './SignaturePad';

// A row of provider buttons (by initials) on the front GUI. Tap a provider to
// "click in" — their saved standing choices populate the forms. Add a provider
// to capture your current setup as that provider's defaults; Save updates them.
// No patient data is involved — provider preferences only.

interface Props {
  // Clicking in fills blanks only; the explicit Load button passes
  // overwrite so a chosen technique's values replace what a prior load put on.
  onApply: (prefs: ProviderPrefs, opts?: { overwrite?: boolean }) => void;
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
  // Being clicked in survives a relaunch, so the bar comes back showing who
  // is in — their Save / Load / signature buttons ready without a re-tap.
  const [activeId, setActiveId] = useState<string | null>(() => {
    const s = getSigner();
    return s.initials ? loadProviders().find((p) => p.initials === s.initials)?.id ?? null : null;
  });
  const [padOpen, setPadOpen] = useState(false);
  // Save / Load opens a quick technique pick — General, LMA, or Regional —
  // because a provider's usual setup differs by how the case is done.
  const [pickFor, setPickFor] = useState<null | 'save' | 'load'>(null);

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
    setPickFor(null);
    setSigner({ initials: p.initials, name: p.prefs.providerName ?? '', signature: p.signature ?? '' });
    // Clicking in applies the General defaults (a saved-before-flavors profile
    // is the General set); the Load button offers LMA / Regional.
    onApply(variantPrefs(p, 'general') ?? p.prefs);
  };

  const pickTechnique = (key: TechniqueKey, label: string) => {
    const p = list.find((x) => x.id === activeId);
    if (!p) return;
    if (pickFor === 'save') {
      const captured = captureCurrentPrefs(p.initials);
      const next = list.map((x) =>
        x.id === p.id
          ? {
              ...x,
              // General doubles as the legacy single set, so devices and code
              // paths that predate flavors keep reading the same defaults.
              ...(key === 'general' ? { prefs: captured } : {}),
              variants: { ...x.variants, [key]: captured },
            }
          : x,
      );
      persist(next);
      window.alert(`Saved the current forms as ${p.initials}'s ${label} defaults.`);
    } else {
      const prefs = variantPrefs(p, key);
      if (!prefs) {
        window.alert(`No ${label} defaults saved for ${p.initials} yet — set the forms up the way you like and tap Save.`);
      } else {
        // Loading is a deliberate "put my values on": the chosen technique's
        // defaults replace what an earlier click-in or load laid down.
        onApply(prefs, { overwrite: true });
        window.alert(`${p.initials}'s ${label} defaults are on the forms.`);
      }
    }
    setPickFor(null);
  };

  const saveSignature = (dataUrl: string) => {
    const p = list.find((x) => x.id === activeId);
    if (!p) return;
    const next = list.map((x) => (x.id === p.id ? { ...x, signature: dataUrl } : x));
    persist(next);
    setSigner({ initials: p.initials, name: p.prefs.providerName ?? '', signature: dataUrl });
    setPadOpen(false);
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
          <button
            type="button"
            className={`chip prov-save${pickFor === 'save' ? ' on' : ''}`}
            onClick={() => setPickFor(pickFor === 'save' ? null : 'save')}
          >
            💾 Save {active.initials}'s defaults
          </button>
          <button
            type="button"
            className={`chip prov-load${pickFor === 'load' ? ' on' : ''}`}
            title="Lay your saved defaults onto the forms — after a clear, or any time"
            onClick={() => setPickFor(pickFor === 'load' ? null : 'load')}
          >
            ⤵ Load {active.initials}'s defaults
          </button>
          {pickFor && (
            <span className="prov-pick">
              <span className="prov-pick-label">{pickFor === 'save' ? 'Save as:' : 'Load:'}</span>
              {TECHNIQUES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`chip prov-pick-chip${pickFor === 'load' && !variantPrefs(active, key) ? ' prov-pick-empty' : ''}`}
                  onClick={() => pickTechnique(key, label)}
                >
                  {label}
                </button>
              ))}
              <button type="button" className="chip" onClick={() => setPickFor(null)}>✕</button>
            </span>
          )}
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

import { useState } from 'react';

// Inline "add a custom condition" input used by the intake views for entries
// that aren't on the paper form's checkbox lists.
export default function AddEntry({ onAdd }: { onAdd: (label: string) => void }) {
  const [text, setText] = useState('');

  const commit = () => {
    const label = text.trim();
    if (!label) return;
    onAdd(label);
    setText('');
  };

  return (
    <div className="addentry">
      <input
        value={text}
        placeholder="Other condition not listed&hellip;"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
      <button type="button" className="chip" onClick={commit} disabled={!text.trim()}>
        + Add
      </button>
    </div>
  );
}

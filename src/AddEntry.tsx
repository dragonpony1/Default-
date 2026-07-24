import { useState } from 'react';
import { noAuto } from './inputProps';

// Inline "add a custom condition" input used by the intake views for entries
// that aren't on the paper form's checkbox lists.
export default function AddEntry({
  onAdd,
  placeholder = 'Other condition not listed…',
}: {
  onAdd: (label: string) => void;
  placeholder?: string;
}) {
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
        {...noAuto}
        value={text}
        placeholder={placeholder}
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

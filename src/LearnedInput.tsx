import { useId, useRef, useState } from 'react';
import { noAuto } from './inputProps';
import { learned, remember, type Bucket } from './learned';

// A text box that remembers what gets typed into it. The suggestions ride in a
// datalist, so the box itself is exactly the size it was — which matters on
// the record, where these sit in cells a few millimetres tall — and nothing
// extra prints.

interface Props {
  bucket: Bucket;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}

export default function LearnedInput({ bucket, value, onChange, className = '', placeholder }: Props) {
  const listId = useId();
  // Read once per focus rather than per keystroke: the list only changes when
  // something is remembered, which happens on the way out of the box.
  const [options, setOptions] = useState<string[]>([]);
  // What the box held on the way in. Passing through a filled box is not the
  // same as typing in it, and should not count as another use.
  const onEntry = useRef('');

  return (
    <>
      <input
        {...noAuto}
        list={listId}
        className={className}
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          setOptions(learned(bucket));
          onEntry.current = value;
        }}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (value !== onEntry.current) remember(bucket, value);
        }}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

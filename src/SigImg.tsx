import { useEffect, useState } from 'react';
import { inkifySignature } from './signatureInk';

// Renders a stamped signature as pure black ink. Processing happens at render
// time, so signatures captured before the ink fix darken too — nobody has to
// re-draw one they already saved.

export default function SigImg({ src, className = 'sig-inline' }: { src: string; className?: string }) {
  const [ink, setInk] = useState(src);

  useEffect(() => {
    let alive = true;
    inkifySignature(src).then((out) => {
      if (alive) setInk(out);
    });
    return () => {
      alive = false;
    };
  }, [src]);

  if (!src) return null;
  return <img className={className} src={ink} alt="signature" />;
}

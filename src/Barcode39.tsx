// Minimal Code 39 barcode renderer for the form's document-control mark.
// N = narrow element, W = wide element; elements alternate bar/space starting
// with a bar (5 bars, 4 spaces per character).
const CODE39: Record<string, string> = {
  '*': 'NWNNWNWNN',
  P: 'NNWNWNNWN',
  R: 'WNNNNNWWN',
  E: 'WNNNWWNNN',
};

const NARROW = 1;
const WIDE = 2.4;

export default function Barcode39({ value, height = 26 }: { value: string; height?: number }) {
  const chars = `*${value}*`.split('');
  const rects: React.ReactElement[] = [];
  let x = 0;
  chars.forEach((c, ci) => {
    const pattern = CODE39[c];
    if (!pattern) return;
    pattern.split('').forEach((w, i) => {
      const width = w === 'W' ? WIDE : NARROW;
      if (i % 2 === 0) {
        rects.push(<rect key={`${ci}-${i}`} x={x} y={0} width={width} height={height} />);
      }
      x += width;
    });
    x += NARROW;
  });
  return (
    <svg
      className="barcode"
      viewBox={`0 0 ${x} ${height}`}
      preserveAspectRatio="none"
      aria-label={`barcode ${value}`}
    >
      {rects}
    </svg>
  );
}

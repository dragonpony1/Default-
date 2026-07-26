// Compose a draft case narrative for the Anesthesia Record's Remarks from
// what has already been charted (checks, text fields, and grid cells). The
// result is a starting point the provider edits — never a substitute for
// their own documentation.

type Ck = Record<string, boolean>;
type Tx = Record<string, string>;
type Cells = Record<string, string>;

// True when any charted value exists in a grid row.
const rowHas = (cells: Cells, row: string) =>
  Object.entries(cells).some(([k, v]) => k.startsWith(`${row}:`) && k !== `${row}:total` && v.trim() !== '');

export function composeNarrative(ck: Ck, tx: Tx, cells: Cells): string {
  const out: string[] = [];
  const add = (s: string) => out.push(s);

  if (ck.preInduction) add('Pre-induction anesthetic reassessment completed.');
  if (ck.chartReviewed) add('Chart reviewed.');

  const technique = [ck.general && 'general anesthesia', ck.regional && 'regional anesthesia', ck.mac && 'MAC']
    .filter(Boolean)
    .join(' + ');
  if (technique) {
    const t = tx.anesStart ? ` beginning at ${tx.anesStart}` : '';
    add(`Technique: ${technique}${t}.`);
  }

  // Standard monitors
  if (ck.pulseOx || ck.capnography || ck.ecg || ck.bpAuto) {
    add('Standard ASA monitors applied.');
  }

  // Induction / airway
  if (ck.rapidSequence) add(`Rapid sequence induction${ck.cricoid ? ' with cricoid pressure' : ''}.`);
  if (ck.intubated || tx.tubeSize) {
    const bits: string[] = [];
    bits.push(`Intubated${ck.ettOral ? ' orally' : ck.ettNasal ? ' nasally' : ''}`);
    if (tx.tubeSize) bits.push(`with a ${tx.tubeSize} mm ETT`);
    if (tx.tubeLength) bits.push(`taped at ${tx.tubeLength} cm`);
    if (tx.attempts) bits.push(`(${tx.attempts} attempt${tx.attempts === '1' ? '' : 's'})`);
    let sentence = bits.join(' ');
    const quality = [ck.easy && 'easy', ck.difficult && 'difficult', ck.atraumatic && 'atraumatic', ck.traumatic && 'traumatic']
      .filter(Boolean)
      .join(', ');
    if (quality) sentence += ` — ${quality}`;
    if (ck.cuffInflated) sentence += '; cuff inflated';
    if (ck.bilateral || ck.equal) sentence += '; breath sounds bilateral and equal';
    if (tx.ettTime) sentence += ` at ${tx.ettTime}`;
    add(sentence + '.');
  } else if (ck.lma || tx.lmaSize) {
    add(`LMA${tx.lmaSize ? ` size ${tx.lmaSize}` : ''} placed, ventilation adequate.`);
  } else if (ck.mask) {
    add('Mask airway maintained.');
  }
  if (ck.arrivedIntubated) add('Patient arrived intubated.');

  // Eyes / positioning / warming
  if (ck.eyeTape || ck.lacriLube) add('Eyes protected.');
  if (ck.pillow || ck.foam || ck.gelDonut || ck.armL || ck.armR) add('Positioned with pressure points padded.');
  if (ck.bairHugger) add('Forced-air warming in use.');

  // Maintenance
  if (rowHas(cells, 'med2')) add('Anesthesia maintained with volatile agent in O₂.');

  // Reversal / emergence
  if (rowHas(cells, 'oth3')) add('Neuromuscular blockade reversed with sugammadex.');
  else if (rowHas(cells, 'oth2')) add('Neuromuscular blockade reversed.');
  if (ck.dentitionUnchanged || ck.recDentition) add('Dentition unchanged.');

  // Disposition
  const status = [ck.awake && 'awake', ck.drowsy && 'drowsy', ck.somnolent && 'somnolent', ck.stable && 'stable', ck.unstable && 'unstable']
    .filter(Boolean)
    .join(', ');
  const o2 = ck.recNasalO2 ? ' on nasal O₂' : ck.maskO2 ? ' on mask O₂' : '';
  if (status || tx.recLocation || o2) {
    add(`Transported to ${tx.recLocation || 'PACU'}${status ? ` ${status}` : ''}${o2}${tx.recTime ? ` at ${tx.recTime}` : ''}.`);
  }
  if (ck.reportToRn) add('Report given to receiving RN.');
  if (tx.anesStop) add(`Anesthesia stop ${tx.anesStop}.`);

  return out.join(' ');
}

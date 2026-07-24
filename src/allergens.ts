// Offline allergy dictionary for the type-ahead. The 'or' class marks
// allergens that change OR setup or anesthetic plan — latex, chlorhexidine
// prep, the standard preop cephalosporin, propofol-relevant foods, sux/MH.

export interface AllergenInfo {
  name: string;
  aliases: string[];
  orAlert: boolean;
}

const a = (name: string, aliases: string[] = [], orAlert = false): AllergenInfo => ({
  name,
  aliases,
  orAlert,
});

export const ALLERGEN_DICTIONARY: AllergenInfo[] = [
  // Antibiotics
  a('penicillin', ['PCN']),
  a('amoxicillin', ['Amoxil']),
  a('amoxicillin-clavulanate', ['Augmentin']),
  a('cefazolin', ['Ancef', 'Kefzol'], true),
  a('cephalexin', ['Keflex']),
  a('ceftriaxone', ['Rocephin']),
  a('cephalosporins', []),
  a('sulfa', ['sulfamethoxazole', 'Bactrim', 'TMP-SMX']),
  a('erythromycin', []),
  a('azithromycin', ['Zithromax', 'Z-pak']),
  a('clindamycin', ['Cleocin']),
  a('vancomycin', []),
  a('ciprofloxacin', ['Cipro']),
  a('levofloxacin', ['Levaquin']),
  a('fluoroquinolones', []),
  a('doxycycline', []),
  a('tetracycline', []),
  a('nitrofurantoin', ['Macrobid']),
  a('gentamicin', []),
  a('metronidazole', ['Flagyl']),
  // Opioids / analgesics
  a('morphine', []),
  a('codeine', []),
  a('oxycodone', ['Percocet', 'OxyContin']),
  a('hydrocodone', ['Norco', 'Vicodin']),
  a('hydromorphone', ['Dilaudid']),
  a('fentanyl', []),
  a('meperidine', ['Demerol']),
  a('tramadol', ['Ultram']),
  a('NSAIDs', ['ibuprofen', 'naproxen']),
  a('aspirin', ['ASA']),
  a('ketorolac', ['Toradol']),
  a('acetaminophen', ['Tylenol']),
  // Anesthesia-critical
  a('latex', [], true),
  a('chlorhexidine', ['CHG', 'Hibiclens'], true),
  a('iodine / contrast dye', ['Betadine', 'povidone-iodine', 'IV contrast'], true),
  a('adhesive / tape', [], true),
  a('lidocaine', [], true),
  a('local anesthetics', ['novocaine', 'bupivacaine'], true),
  a('succinylcholine', ['sux'], true),
  a('propofol', ['Diprivan'], true),
  a('ketamine', [], true),
  a('etomidate', [], true),
  a('malignant hyperthermia (self or family)', ['MH'], true),
  a('heparin (HIT)', ['heparin-induced thrombocytopenia'], true),
  a('eggs', ['egg'], true),
  a('soy', ['soybean'], true),
  // Antiemetics / other meds
  a('ondansetron', ['Zofran']),
  a('metoclopramide', ['Reglan']),
  a('promethazine', ['Phenergan']),
  a('dexamethasone', ['Decadron']),
  a('prednisone', []),
  a('lisinopril (cough/angioedema)', ['ACE inhibitors']),
  a('statins', ['atorvastatin', 'simvastatin']),
  a('gabapentin', ['Neurontin']),
  a('gadolinium (MRI contrast)', []),
  // Foods / environmental
  a('shellfish', []),
  a('peanuts', ['peanut']),
  a('tree nuts', []),
  a('red dye', []),
  a('nickel', []),
  a('bee stings', ['bees', 'wasp']),
];

export function isOrAlert(name: string): boolean {
  const n = name.trim().toLowerCase();
  return ALLERGEN_DICTIONARY.some(
    (x) =>
      x.orAlert &&
      (x.name.toLowerCase() === n || x.aliases.some((al) => al.toLowerCase() === n)),
  );
}

// Prefix-at-word-start match against names and aliases.
export function searchAllergens(query: string, extra: string[] = [], limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = (s: string) => s.toLowerCase().split(/[\s\-/()]+/).some((w) => w.startsWith(q));
  const out: string[] = [];
  const push = (label: string) => {
    if (!out.includes(label) && out.length < limit) out.push(label);
  };
  for (const name of extra) if (starts(name)) push(name);
  for (const x of ALLERGEN_DICTIONARY) {
    if (starts(x.name)) push(x.name);
    for (const al of x.aliases) {
      if (starts(al)) push(x.name);
    }
  }
  return out;
}

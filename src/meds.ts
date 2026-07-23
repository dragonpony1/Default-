// Offline medication dictionary for the type-ahead. Everything stays on the
// device — no lookups leave the browser. Classes drive the anesthesia-relevant
// "last dose" prompt: anticoagulants/antiplatelets, GLP-1 agonists, insulin.

export type MedClass = 'anticoag' | 'antiplatelet' | 'glp1' | 'insulin' | '';

export interface MedInfo {
  generic: string;
  brands: string[];
  cls: MedClass;
}

const m = (generic: string, brands: string[] = [], cls: MedClass = ''): MedInfo => ({
  generic,
  brands,
  cls,
});

export const MED_DICTIONARY: MedInfo[] = [
  // Anticoagulants / antiplatelets
  m('warfarin', ['Coumadin'], 'anticoag'),
  m('apixaban', ['Eliquis'], 'anticoag'),
  m('rivaroxaban', ['Xarelto'], 'anticoag'),
  m('dabigatran', ['Pradaxa'], 'anticoag'),
  m('edoxaban', ['Savaysa'], 'anticoag'),
  m('enoxaparin', ['Lovenox'], 'anticoag'),
  m('heparin', [], 'anticoag'),
  m('fondaparinux', ['Arixtra'], 'anticoag'),
  m('clopidogrel', ['Plavix'], 'antiplatelet'),
  m('ticagrelor', ['Brilinta'], 'antiplatelet'),
  m('prasugrel', ['Effient'], 'antiplatelet'),
  m('aspirin', ['ASA', 'Ecotrin'], 'antiplatelet'),
  m('aspirin-dipyridamole', ['Aggrenox'], 'antiplatelet'),
  m('cilostazol', ['Pletal'], 'antiplatelet'),
  // GLP-1 agonists
  m('semaglutide', ['Ozempic', 'Wegovy', 'Rybelsus'], 'glp1'),
  m('tirzepatide', ['Mounjaro', 'Zepbound'], 'glp1'),
  m('dulaglutide', ['Trulicity'], 'glp1'),
  m('liraglutide', ['Victoza', 'Saxenda'], 'glp1'),
  m('exenatide', ['Byetta', 'Bydureon'], 'glp1'),
  // Insulins
  m('insulin glargine', ['Lantus', 'Basaglar', 'Toujeo'], 'insulin'),
  m('insulin detemir', ['Levemir'], 'insulin'),
  m('insulin degludec', ['Tresiba'], 'insulin'),
  m('insulin lispro', ['Humalog'], 'insulin'),
  m('insulin aspart', ['Novolog'], 'insulin'),
  m('insulin regular', ['Humulin R', 'Novolin R'], 'insulin'),
  m('insulin NPH', ['Humulin N', 'Novolin N'], 'insulin'),
  m('insulin 70/30', ['Humulin 70/30', 'Novolin 70/30'], 'insulin'),
  // Cardiovascular
  m('lisinopril', ['Zestril', 'Prinivil']),
  m('enalapril', ['Vasotec']),
  m('ramipril', ['Altace']),
  m('losartan', ['Cozaar']),
  m('valsartan', ['Diovan']),
  m('olmesartan', ['Benicar']),
  m('irbesartan', ['Avapro']),
  m('sacubitril-valsartan', ['Entresto']),
  m('amlodipine', ['Norvasc']),
  m('nifedipine', ['Procardia']),
  m('diltiazem', ['Cardizem', 'Cartia']),
  m('verapamil', ['Calan']),
  m('metoprolol', ['Lopressor', 'Toprol']),
  m('atenolol', ['Tenormin']),
  m('carvedilol', ['Coreg']),
  m('propranolol', ['Inderal']),
  m('bisoprolol', ['Zebeta']),
  m('labetalol', ['Trandate']),
  m('nebivolol', ['Bystolic']),
  m('hydrochlorothiazide', ['HCTZ', 'Microzide']),
  m('chlorthalidone', ['Thalitone']),
  m('furosemide', ['Lasix']),
  m('torsemide', ['Demadex']),
  m('bumetanide', ['Bumex']),
  m('spironolactone', ['Aldactone']),
  m('triamterene-HCTZ', ['Maxzide', 'Dyazide']),
  m('clonidine', ['Catapres']),
  m('doxazosin', ['Cardura']),
  m('hydralazine', ['Apresoline']),
  m('isosorbide mononitrate', ['Imdur']),
  m('nitroglycerin', ['Nitrostat']),
  m('ranolazine', ['Ranexa']),
  m('digoxin', ['Lanoxin']),
  m('amiodarone', ['Pacerone']),
  m('flecainide', ['Tambocor']),
  m('sotalol', ['Betapace']),
  m('atorvastatin', ['Lipitor']),
  m('simvastatin', ['Zocor']),
  m('rosuvastatin', ['Crestor']),
  m('pravastatin', ['Pravachol']),
  m('lovastatin', ['Mevacor']),
  m('ezetimibe', ['Zetia']),
  m('fenofibrate', ['Tricor']),
  m('gemfibrozil', ['Lopid']),
  m('icosapent ethyl', ['Vascepa']),
  // Diabetes (non-GLP-1, non-insulin)
  m('metformin', ['Glucophage']),
  m('glipizide', ['Glucotrol']),
  m('glyburide', ['DiaBeta']),
  m('glimepiride', ['Amaryl']),
  m('sitagliptin', ['Januvia']),
  m('linagliptin', ['Tradjenta']),
  m('empagliflozin', ['Jardiance']),
  m('dapagliflozin', ['Farxiga']),
  m('canagliflozin', ['Invokana']),
  m('pioglitazone', ['Actos']),
  // Respiratory
  m('albuterol', ['ProAir', 'Ventolin', 'Proventil']),
  m('levalbuterol', ['Xopenex']),
  m('ipratropium', ['Atrovent']),
  m('tiotropium', ['Spiriva']),
  m('umeclidinium', ['Incruse']),
  m('fluticasone inhaled', ['Flovent']),
  m('fluticasone-salmeterol', ['Advair']),
  m('fluticasone-vilanterol', ['Breo']),
  m('budesonide-formoterol', ['Symbicort']),
  m('montelukast', ['Singulair']),
  m('theophylline', []),
  // GI
  m('omeprazole', ['Prilosec']),
  m('pantoprazole', ['Protonix']),
  m('esomeprazole', ['Nexium']),
  m('lansoprazole', ['Prevacid']),
  m('famotidine', ['Pepcid']),
  m('ondansetron', ['Zofran']),
  m('metoclopramide', ['Reglan']),
  m('sucralfate', ['Carafate']),
  m('dicyclomine', ['Bentyl']),
  m('mesalamine', ['Lialda', 'Asacol']),
  // Thyroid / endocrine
  m('levothyroxine', ['Synthroid', 'Levoxyl']),
  m('liothyronine', ['Cytomel']),
  m('methimazole', ['Tapazole']),
  m('prednisone', ['Deltasone']),
  m('hydrocortisone', ['Cortef']),
  m('dexamethasone', ['Decadron']),
  m('fludrocortisone', ['Florinef']),
  m('testosterone', ['AndroGel']),
  m('estradiol', ['Estrace']),
  m('alendronate', ['Fosamax']),
  m('denosumab', ['Prolia']),
  // Psych
  m('sertraline', ['Zoloft']),
  m('fluoxetine', ['Prozac']),
  m('escitalopram', ['Lexapro']),
  m('citalopram', ['Celexa']),
  m('paroxetine', ['Paxil']),
  m('venlafaxine', ['Effexor']),
  m('desvenlafaxine', ['Pristiq']),
  m('duloxetine', ['Cymbalta']),
  m('bupropion', ['Wellbutrin']),
  m('mirtazapine', ['Remeron']),
  m('trazodone', ['Desyrel']),
  m('amitriptyline', ['Elavil']),
  m('nortriptyline', ['Pamelor']),
  m('quetiapine', ['Seroquel']),
  m('aripiprazole', ['Abilify']),
  m('risperidone', ['Risperdal']),
  m('olanzapine', ['Zyprexa']),
  m('ziprasidone', ['Geodon']),
  m('lurasidone', ['Latuda']),
  m('lithium', ['Lithobid']),
  m('lamotrigine', ['Lamictal']),
  m('valproate', ['Depakote']),
  m('buspirone', ['Buspar']),
  m('alprazolam', ['Xanax']),
  m('lorazepam', ['Ativan']),
  m('clonazepam', ['Klonopin']),
  m('diazepam', ['Valium']),
  m('temazepam', ['Restoril']),
  m('zolpidem', ['Ambien']),
  m('eszopiclone', ['Lunesta']),
  m('suvorexant', ['Belsomra']),
  m('phenelzine', ['Nardil']),
  m('tranylcypromine', ['Parnate']),
  m('selegiline', ['Emsam']),
  m('amphetamine-dextroamphetamine', ['Adderall']),
  m('methylphenidate', ['Ritalin', 'Concerta']),
  m('lisdexamfetamine', ['Vyvanse']),
  m('atomoxetine', ['Strattera']),
  m('naltrexone', ['Vivitrol']),
  m('buprenorphine-naloxone', ['Suboxone']),
  m('methadone', ['Dolophine']),
  m('varenicline', ['Chantix']),
  // Pain / neuro / musculoskeletal
  m('gabapentin', ['Neurontin']),
  m('pregabalin', ['Lyrica']),
  m('tramadol', ['Ultram']),
  m('oxycodone', ['OxyContin', 'Percocet']),
  m('hydrocodone-acetaminophen', ['Norco', 'Vicodin']),
  m('morphine', ['MS Contin']),
  m('hydromorphone', ['Dilaudid']),
  m('fentanyl patch', ['Duragesic']),
  m('acetaminophen', ['Tylenol']),
  m('ibuprofen', ['Advil', 'Motrin']),
  m('naproxen', ['Aleve', 'Naprosyn']),
  m('meloxicam', ['Mobic']),
  m('celecoxib', ['Celebrex']),
  m('diclofenac', ['Voltaren']),
  m('indomethacin', ['Indocin']),
  m('cyclobenzaprine', ['Flexeril']),
  m('tizanidine', ['Zanaflex']),
  m('baclofen', ['Lioresal']),
  m('methocarbamol', ['Robaxin']),
  m('carisoprodol', ['Soma']),
  m('sumatriptan', ['Imitrex']),
  m('rizatriptan', ['Maxalt']),
  m('topiramate', ['Topamax']),
  m('levetiracetam', ['Keppra']),
  m('phenytoin', ['Dilantin']),
  m('carbamazepine', ['Tegretol']),
  m('oxcarbazepine', ['Trileptal']),
  m('donepezil', ['Aricept']),
  m('memantine', ['Namenda']),
  m('carbidopa-levodopa', ['Sinemet']),
  m('ropinirole', ['Requip']),
  m('pramipexole', ['Mirapex']),
  // Immune / other
  m('methotrexate', ['Trexall']),
  m('hydroxychloroquine', ['Plaquenil']),
  m('sulfasalazine', ['Azulfidine']),
  m('azathioprine', ['Imuran']),
  m('mycophenolate', ['CellCept']),
  m('tacrolimus', ['Prograf']),
  m('cyclosporine', ['Neoral']),
  m('adalimumab', ['Humira']),
  m('etanercept', ['Enbrel']),
  m('allopurinol', ['Zyloprim']),
  m('colchicine', ['Colcrys']),
  m('febuxostat', ['Uloric']),
  m('tamsulosin', ['Flomax']),
  m('finasteride', ['Proscar', 'Propecia']),
  m('oxybutynin', ['Ditropan']),
  m('mirabegron', ['Myrbetriq']),
  m('sildenafil', ['Viagra']),
  m('tadalafil', ['Cialis']),
  m('potassium chloride', ['K-Dur', 'Klor-Con']),
  m('ferrous sulfate', ['iron']),
  m('folic acid', []),
  m('cyanocobalamin', ['B12']),
  m('cholecalciferol', ['vitamin D3']),
  m('multivitamin', []),
  m('fish oil', ['omega-3']),
  m('melatonin', []),
  m('meclizine', ['Antivert']),
  m('promethazine', ['Phenergan']),
  m('hydroxyzine', ['Vistaril', 'Atarax']),
  m('cetirizine', ['Zyrtec']),
  m('loratadine', ['Claritin']),
  m('fexofenadine', ['Allegra']),
  m('diphenhydramine', ['Benadryl']),
];

export const CLASS_LABELS: Record<Exclude<MedClass, ''>, string> = {
  anticoag: 'Anticoagulant',
  antiplatelet: 'Antiplatelet',
  glp1: 'GLP-1',
  insulin: 'Insulin',
};

// Classes that trigger the "last dose" prompt.
export const LAST_DOSE_CLASSES: MedClass[] = ['anticoag', 'antiplatelet', 'glp1', 'insulin'];

export function classOf(name: string): MedClass {
  const n = name.trim().toLowerCase();
  for (const med of MED_DICTIONARY) {
    if (med.generic.toLowerCase() === n) return med.cls;
    if (med.brands.some((b) => b.toLowerCase() === n)) return med.cls;
  }
  return '';
}

// Prefix-at-word-start match against generics and brands, e.g. "eli" finds
// Eliquis, "met" finds metformin/metoprolol/methylphenidate.
export function searchMeds(query: string, extra: string[] = [], limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = (s: string) => s.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(q));
  const out: string[] = [];
  const push = (label: string) => {
    if (!out.includes(label) && out.length < limit) out.push(label);
  };
  for (const name of extra) if (starts(name)) push(name);
  for (const med of MED_DICTIONARY) {
    if (starts(med.generic)) push(med.generic);
    for (const b of med.brands) {
      if (starts(b)) push(`${b} (${med.generic})`);
    }
  }
  return out;
}

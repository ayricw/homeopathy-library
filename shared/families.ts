// Remedy families: which kingdom and family (or chemical elements) each remedy of the repertory
// belongs to, for the family view of a case, the periodic table and the plant and animal tables.
// Plant and animal groups are listed by the repertory's own abbreviations; mineral remedies are
// matched to elements by the Latin words in their names ("Kalium Carbonicum" is potassium and carbon).
// Botanical families follow common homeopathic usage (for example Loganiaceae, Liliiflorae).

export type Kingdom = "Mineral" | "Plant" | "Animal" | "Nosode" | "Other";

export const KINGDOMS: Kingdom[] = ["Mineral", "Plant", "Animal", "Nosode", "Other"];

type Groups = Record<string, string>;

/** Plant families: family name, then the remedies' abbreviations separated by spaces. */
export const PLANT_FAMILIES: Groups = {
  Ranunculaceae: "Acon. Acon-c. Acon-f. Aconin. Acon-l. Act-sp. Adon. Cimic. Clem. Hell. Hydr. Puls. Puls-n. Ran-a. Ran-b. Ran-s. Staph. Paeon.",
  Solanaceae: "Bell. Hyos. Stram. Caps. Dulc. Tab. Sol-m. Sol-n. Sol-t-ae. Lycpr. Atro. Dubin.",
  Anacardiaceae: "Anac. Anac-oc. Rhus-a. Rhus-g. Rhus-r. Rhus-t. Rhus-v. Com.",
  "Asteraceae (Compositae)": "Abrot. Absin. Arn. Art-v. Bell-p. Calen. Card-b. Card-m. Cham. Cina Echi. Erech. Erig. Eup-per. Eup-pur. Gnaph. Grin. Inul. Lappa Lact. Mill. Senec. Solid. Tanac. Tarax. Tus-p. Wye. Anth. Cent. Part-h. Sant. Brach.",
  "Apiaceae (Umbelliferae)": "Ammc. Aeth. Asaf. Cic. Con. Oena. Phel. Petros. Sumb. Ap-g. Hydrc. Ery-a. Ziz.",
  Loganiaceae: "Nux-v. Ign. Gels. Spig. Spig-m. Cur. Upa. Stry.",
  Papaveraceae: "Op. Chel. Sang. Sanguin-n. Morph. Cod. Narcot. Herin. Apom.",
  Rubiaceae: "Chin. Chin-b. Chin-ar. Chin-s. Cinch. Coff. Coff-t. Ip. Cahin. Mit.",
  Cactaceae: "Cact. Cere-b. Cere-s.",
  Euphorbiaceae: "Euph. Croto-t. Jatr. Manc. Still. Acal. Hura Merl. Casc.",
  "Fabaceae (Leguminosae)": "Bapt. Meli. Rob. Phys. Senn. Lath. Trif-p. Cop. Indg. Dol. Genist. Saroth-s. Oxyt. Gymn. Haem. Alf. Der. Calli. Tong. Bals-p.",
  Rutaceae: "Ruta Xan. Dict. Ptel. Ang. Jab. Piloc. Cit-a.",
  Simaroubaceae: "Bruc. Cedr. Ail.",
  Cucurbitaceae: "Bry. Coloc. Elat.",
  "Lamiaceae (Labiatae)": "Lycps. Teucr. Oci. Orig. Coll. Scut. Menth. Hedeo. Lam. Plect. Agn.",
  Rosaceae: "Laur. Prun. Prun-p. Crat. Amyg-am. Amyg-p. Frag. Pyrus",
  Ericaceae: "Led. Kalm. Rhod. Uva Epig. Chim. Chim-m.",
  Conifers: "Thuj. Sabin. Abies-c. Abies-n. Pin-s. Ter. Tax. Juni-v. Agath-a.",
  Fungi: "Agar. Agar-em. Agar-ph. Bov. Sec. Ust. Bol. Phal.",
  Lichens: "Stict. Clad-r.",
  "Club mosses, horsetails and ferns": "Lyc. Equis. Fil.",
  Seaweeds: "Fuc.",
  Berberidaceae: "Berb. Caul. Podo.",
  "Plantaginaceae (figworts)": "Dig. Euphr. Verb. Grat. Lept. Plan.",
  Apocynaceae: "Apoc. Apoc-a. Olnd. Vinc. Stroph. Asc-c. Asc-t. Calo. Alst-c. Cund.",
  "Liliiflorae (lilies and allies)": "Lil-t. Verat. Verat-v. Sabad. Colch. All-c. All-s. Aloe Squil. Par. Helon. Tril. Conv. Aspar. Yuc. Alet. Sars. Dios.",
  Araceae: "Arum-d. Arum-i. Arum-m. Arum-t. Calad. Ictod. Lem-m.",
  Iridaceae: "Iris Iris-fl. Iris-foe. Croc.",
  Orchidaceae: "Cypr. Spira.",
  "Poaceae (grasses)": "Lol. Arund-d. Anan.",
  "Brassicaceae (Cruciferae)": "Coch. Iber. Raph. Sin-a. Sin-n. Thlaspi Lepi.",
  Menispermaceae: "Cocc. Menis. Pareir.",
  Polygonaceae: "Rheum Rumx. Fago. Polyg. Polyg-s.",
  Piperaceae: "Cub. Pip-m. Pip-n.",
  Myrtaceae: "Eucal. Eug. Myrt-c. Ango. Caj.",
  Lauraceae: "Camph. Cinnam.",
  Cannabaceae: "Cann-i. Cann-s. Lup.",
  Sapindaceae: "Aesc. Aesc-g. Paull-p.",
  Primulaceae: "Anag. Cycl.",
  Aristolochiaceae: "Asar. Serp.",
  Thymelaeaceae: "Daph. Dirc. Mez.",
  Gentianaceae: "Gent-c. Gent-l. Canch. Meny.",
  Malvaceae: "Goss. Til. Thea",
  Araliaceae: "Gins. Aral.",
  Convolvulaceae: "Ipom. Jal. Convo-d.",
  Bignoniaceae: "Jac. Jac-c.",
  Juglandaceae: "Jug-c. Jug-r.",
  Campanulaceae: "Lob. Lob-c. Lob-s.",
  Boraginaceae: "Myos. Onos. Symph.",
  Myristicaceae: "Myris. Nux-m.",
  Nymphaeaceae: "Nuph. Nym.",
  Salicaceae: "Pop. Salx-f. Salx-n.",
  "Caprifoliaceae (honeysuckles and valerian)": "Samb. Vib. Sym-r. Trio. Valer.",
  Violaceae: "Viol-o. Viol-t.",
  Cornaceae: "Corn. Corn-f. Corn-s.",
  Oleaceae: "Chion. Frax.",
  Amaranthaceae: "Chen-a. Chen-v.",
  "Other plant families": "Anis. Asim. Casta-v. Cean. Cist. Coca Cocain. Cot. Dros. Euon. Euon-a. Gamb. Ger. Gran. Guai. Guare. Ham. Hydrang. Hyper. Junc. Lachn. Linu-c. Myric. Orob-r. Pen. Peti. Phyt. Rat. Sabal Sarr. Seneg. Stel. Urt-u. Visc. Zing. Plumbg. Cori-r.",
};

/** Animal groups, as homeopaths group them. */
export const ANIMAL_GROUPS: Groups = {
  Spiders: "Aran. Aran-s. Lat-m. Mygal. Tarent. Tarent-c. Ther. Trom.",
  Snakes: "Lach. Crot-c. Crot-h. Naja Elaps Cench. Vip. Both-l.",
  "Other reptiles and amphibians": "Bufo Bufo-s. Helo. Salam. Amph.",
  Insects: "Apis Canth. Form. Vesp. Coc-c. Cimx. Ped. Blatta Culx. Dor. Pulx. Aphis. Cocci-s.",
  "Sea animals": "Sep. Murx. Spong. Bad. Cor-r. Aster. Astac. Hom.",
  Fish: "Gad. Ol-j. Ser-ang.",
  Birds: "Falco-p. Cygnus-b. Guano",
  "Mammals and milks": "Lac-c. Lac-d. Lac-f. Mosch. Cast. Cast-eq. Meph. Ambr. Hipp. Ol-an. Colos. Sac-l.",
};

/** Nosodes, sarcodes and imponderables. */
export const NOSODE_GROUPS: Groups = {
  Nosodes: "AIDS Anthr. Hippoz. Lyss. Maland. Malar. Med. Per. Psor. Pyrog. Syph. Tub. Vac. Vario.",
  "Sarcodes and glands": "Adren. Thyr. Pitu-gl. Ov. Chol. Lec. Ingluv.",
  Imponderables: "Sol M-arct. M-art. M-aust. Posit. Dream.",
};

/** Not one of the kingdoms: waters, drugs and chemical compounds. */
export const OTHER_GROUPS: Groups = {
  "Mineral waters": "Bart. Carl. Get. Kiss. Sanic. Tep. Wies. Wild.",
  "Drugs and organic compounds":
    "Acetan. Alco. Anil. Benz. Chlf. Chlol. Ether Eupi. Iodof. LSD. Naphtin. Nitrob. Glyc. Kreos. Carb-ac. Spart. Sapin. Sac-alb. Acet-ac. Benz-ac. Cit-ac. Gall-ac. Lac-ac. Ox-ac. Pic-ac. Sal-ac. Tart-ac. Hydr-ac. Aml-n. Glon. Nit-s-d.",
};

export interface Element {
  symbol: string;
  name: string;
  number: number;
  /** Row and column in the standard 18-column table; lanthanides and actinides are rows 9 and 10. */
  row: number;
  col: number;
  /** Latin words in remedy names that mean this element. */
  stems: string[];
}

// [symbol, name, row, col, stems]
const E: [string, string, number, number, string?][] = [
  ["H", "Hydrogen", 1, 1, "hydrogenisatum hydrogenium"], ["He", "Helium", 1, 18],
  ["Li", "Lithium", 2, 1, "lithium"], ["Be", "Beryllium", 2, 2], ["B", "Boron", 2, 13, "borax boricum"], ["C", "Carbon", 2, 14, "carbo carbonicum carbonica carboneum graphites"],
  ["N", "Nitrogen", 2, 15, "nitricum nitricus nitrosum nitrogenium nitri ammonium nitromuriaticum"], ["O", "Oxygen", 2, 16, "oxydatum oxygenisatum oxygenatum ozonum"],
  ["F", "Fluorine", 2, 17, "fluoricum fluorica"], ["Ne", "Neon", 2, 18],
  ["Na", "Sodium", 3, 1, "natrium natronatum borax"], ["Mg", "Magnesium", 3, 2, "magnesium"], ["Al", "Aluminium", 3, 13, "alumina aluminium alumen kaolinum"],
  ["Si", "Silicon", 3, 14, "silicea silicicum silicata kaolinum"], ["P", "Phosphorus", 3, 15, "phosphorus phosphoricum phosphorica hypophosphorosa"],
  ["S", "Sulphur", 3, 16, "sulphur sulphuricum sulphurica sulphuratum hepar"], ["Cl", "Chlorine", 3, 17, "chlorum muriaticum muriatica chloricum hypochlorosum"], ["Ar", "Argon", 3, 18],
  ["K", "Potassium", 4, 1, "kalium alumen"], ["Ca", "Calcium", 4, 2, "calcarea hepar"], ["Sc", "Scandium", 4, 3], ["Ti", "Titanium", 4, 4], ["V", "Vanadium", 4, 5],
  ["Cr", "Chromium", 4, 6, "chromicum chromium bichromicum"], ["Mn", "Manganese", 4, 7, "manganum permanganatum"], ["Fe", "Iron", 4, 8, "ferrum ferrocyanatum"],
  ["Co", "Cobalt", 4, 9, "cobaltum"], ["Ni", "Nickel", 4, 10, "niccolum"], ["Cu", "Copper", 4, 11, "cuprum"], ["Zn", "Zinc", 4, 12, "zincum"],
  ["Ga", "Gallium", 4, 13], ["Ge", "Germanium", 4, 14], ["As", "Arsenic", 4, 15, "arsenicum arsenicosum arsenicosa"], ["Se", "Selenium", 4, 16, "selenium"],
  ["Br", "Bromine", 4, 17, "bromum bromatum"], ["Kr", "Krypton", 4, 18],
  ["Rb", "Rubidium", 5, 1], ["Sr", "Strontium", 5, 2, "strontium"], ["Y", "Yttrium", 5, 3], ["Zr", "Zirconium", 5, 4], ["Nb", "Niobium", 5, 5], ["Mo", "Molybdenum", 5, 6],
  ["Tc", "Technetium", 5, 7], ["Ru", "Ruthenium", 5, 8], ["Rh", "Rhodium", 5, 9], ["Pd", "Palladium", 5, 10, "palladium"], ["Ag", "Silver", 5, 11, "argentum"],
  ["Cd", "Cadmium", 5, 12, "cadmium"], ["In", "Indium", 5, 13, "indium"], ["Sn", "Tin", 5, 14, "stannum"], ["Sb", "Antimony", 5, 15, "antimonium"],
  ["Te", "Tellurium", 5, 16, "tellurium"], ["I", "Iodine", 5, 17, "iodium iodatum iodata iodatus"], ["Xe", "Xenon", 5, 18],
  ["Cs", "Caesium", 6, 1], ["Ba", "Barium", 6, 2, "baryta"], ["Hf", "Hafnium", 6, 4], ["Ta", "Tantalum", 6, 5], ["W", "Tungsten", 6, 6], ["Re", "Rhenium", 6, 7],
  ["Os", "Osmium", 6, 8, "osmium"], ["Ir", "Iridium", 6, 9, "iridium"], ["Pt", "Platinum", 6, 10, "platinum"], ["Au", "Gold", 6, 11, "aurum auratus auratum"],
  ["Hg", "Mercury", 6, 12, "mercurius cinnabaris"], ["Tl", "Thallium", 6, 13, "thallium"], ["Pb", "Lead", 6, 14, "plumbum"], ["Bi", "Bismuth", 6, 15, "bismutum bismuthum"],
  ["Po", "Polonium", 6, 16], ["At", "Astatine", 6, 17], ["Rn", "Radon", 6, 18],
  ["Fr", "Francium", 7, 1], ["Ra", "Radium", 7, 2, "radium"],
  ["La", "Lanthanum", 9, 3], ["Ce", "Cerium", 9, 4], ["Pr", "Praseodymium", 9, 5], ["Nd", "Neodymium", 9, 6], ["Pm", "Promethium", 9, 7], ["Sm", "Samarium", 9, 8],
  ["Eu", "Europium", 9, 9], ["Gd", "Gadolinium", 9, 10], ["Tb", "Terbium", 9, 11], ["Dy", "Dysprosium", 9, 12], ["Ho", "Holmium", 9, 13], ["Er", "Erbium", 9, 14],
  ["Tm", "Thulium", 9, 15], ["Yb", "Ytterbium", 9, 16], ["Lu", "Lutetium", 9, 17],
  ["Ac", "Actinium", 10, 3], ["Th", "Thorium", 10, 4], ["Pa", "Protactinium", 10, 5], ["U", "Uranium", 10, 6, "uranium"], ["Np", "Neptunium", 10, 7], ["Pu", "Plutonium", 10, 8],
];

/** Atomic numbers in table order are not needed for matching; they are shown on each cell. */
const NUMBERS: Record<string, number> = Object.fromEntries(
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu"
    .split(" ")
    .map((s, i) => [s, i + 1]),
);

export const ELEMENTS: Element[] = E.map(([symbol, name, row, col, stems]) => ({
  symbol,
  name,
  number: NUMBERS[symbol],
  row,
  col,
  stems: stems ? stems.split(" ") : [],
}));

const STEM_TO_ELEMENT = new Map<string, string>();
for (const e of ELEMENTS) for (const s of e.stems) STEM_TO_ELEMENT.set(s, STEM_TO_ELEMENT.has(s) ? `${STEM_TO_ELEMENT.get(s)} ${e.symbol}` : e.symbol);

export interface RemedyGroup {
  kingdom: Kingdom;
  /** Family or group name; for minerals, "Metals and salts". */
  family: string;
  /** Element symbols in the remedy's name (minerals only). */
  elements: string[];
}

const index = new Map<string, { kingdom: Kingdom; family: string }>();
const add = (groups: Groups, kingdom: Kingdom) => {
  for (const [family, list] of Object.entries(groups)) for (const abbrev of list.split(/\s+/).filter(Boolean)) index.set(abbrev.toLowerCase(), { kingdom, family });
};
add(PLANT_FAMILIES, "Plant");
add(ANIMAL_GROUPS, "Animal");
add(NOSODE_GROUPS, "Nosode");
add(OTHER_GROUPS, "Other");

/** The element symbols named by a remedy's Latin name, in order, without repeats. */
export function elementsOf(name: string): string[] {
  const out: string[] = [];
  for (const w of name.toLowerCase().split(/[^a-z]+/)) {
    const hit = STEM_TO_ELEMENT.get(w);
    if (hit) for (const s of hit.split(" ")) if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** Elements whose own series name a mineral remedy's group (for the family view), e.g. "Kalium" for Kali carb. */
const SERIES_NAME: Record<string, string> = {
  K: "Kalium salts", Na: "Natrium salts", Ca: "Calcarea salts", Mg: "Magnesium salts", Ba: "Baryta salts", Fe: "Ferrum salts",
  Cu: "Cuprum salts", Zn: "Zincum salts", Au: "Aurum salts", Ag: "Argentum salts", Hg: "Mercurius salts", As: "Arsenicum salts",
  Sb: "Antimonium salts", Pt: "Platinum salts", Li: "Lithium salts", Sr: "Strontium salts", Al: "Alumina salts", Mn: "Manganum salts",
  Ni: "Niccolum salts", Pb: "Plumbum salts", Cd: "Cadmium salts", Ir: "Iridium salts", Bi: "Bismuth salts", Cr: "Chromium salts",
};

/** Kingdom, family and elements of one remedy. */
export function groupOf(abbrev: string, name: string): RemedyGroup {
  const listed = index.get(abbrev.toLowerCase());
  if (listed) return { ...listed, elements: [] };
  const elements = elementsOf(name);
  if (elements.length) {
    const lead = elements.find((s) => SERIES_NAME[s]);
    return { kingdom: "Mineral", family: lead ? SERIES_NAME[lead] : "Elements and acids", elements };
  }
  // Mineral remedies whose names do not name an element.
  if (/^(caust|petr|lava|lap-a|kaol|anthro)/i.test(abbrev)) return { kingdom: "Mineral", family: "Other minerals", elements: [] };
  return { kingdom: "Other", family: "Not grouped yet", elements: [] };
}

export const KINGDOM_ICON: Record<Kingdom, string> = { Mineral: "gem", Plant: "leaf", Animal: "paw", Nosode: "flask", Other: "shapes" };

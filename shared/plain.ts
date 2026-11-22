// Finding rubrics from everyday words ("feels like ants crawling", "can't sleep after midnight").
// The repertory uses old, technical words (formication, sleeplessness, agg.), so everyday phrases and
// words are turned into the repertory's words first, then rubrics are ranked by how many of the
// typed ideas they contain. It runs in the browser on the loaded repertory: nothing is sent anywhere.
import { stem, SYNONYMS } from "./suggest";
import { toRubric, type RepertoryFile, type Rubric } from "./repertory";

/** Everyday phrases and their repertory words. Longer phrases are tried first. */
const PHRASES: [string, string][] = [
  ["pins and needles", "tingling numbness"],
  ["ants crawling", "formication"],
  ["crawling ants", "formication"],
  ["crawling sensation", "formication"],
  ["runny nose", "nose coryza discharge"],
  ["stuffy nose", "nose obstruction"],
  ["blocked nose", "nose obstruction"],
  ["stuffed up", "nose obstruction"],
  ["sore throat", "throat pain"],
  ["throwing up", "vomiting"],
  ["throw up", "vomiting"],
  ["can't sleep", "sleeplessness"],
  ["cannot sleep", "sleeplessness"],
  ["can not sleep", "sleeplessness"],
  ["trouble sleeping", "sleeplessness"],
  ["wakes up", "waking"],
  ["hot flashes", "heat flushes"],
  ["hot flushes", "heat flushes"],
  ["bad breath", "mouth odor offensive"],
  ["wets the bed", "urination involuntary night"],
  ["bed wetting", "urination involuntary night"],
  ["hair loss", "hair falling"],
  ["hair falling out", "hair falling"],
  ["cold sore", "herpes lips"],
  ["cold sores", "herpes lips"],
  ["short of breath", "respiration difficult"],
  ["out of breath", "respiration difficult"],
  ["shortness of breath", "respiration difficult"],
  ["racing heart", "palpitation"],
  ["heart racing", "palpitation"],
  ["heart pounding", "palpitation"],
  ["ringing in the ears", "ear noises ringing"],
  ["ringing ears", "ear noises ringing"],
  ["motion sickness", "riding nausea"],
  ["car sick", "riding carriage nausea"],
  ["carsick", "riding carriage nausea"],
  ["seasick", "seasickness"],
  ["temper tantrum", "anger rage"],
  ["temper tantrums", "anger rage"],
  ["stage fright", "anticipation"],
  ["fear of the dark", "fear dark"],
  ["afraid of the dark", "fear dark"],
  ["fear of dying", "fear death"],
  ["afraid of dying", "fear death"],
  ["upset stomach", "stomach disordered"],
  ["growing pains", "extremities pain growing"],
  ["pink eye", "eye inflammation"],
  ["bed sores", "decubitus"],
  ["stiff neck", "neck stiffness"],
  ["lower back", "back lumbar"],
  ["low back", "back lumbar"],
  ["after eating", "eating after"],
  ["before periods", "menses before"],
  ["before her period", "menses before"],
  ["during periods", "menses during"],
  ["at night", "night"],
  ["in the morning", "morning"],
  ["in the evening", "evening"],
  ["left side", "left"],
  ["right side", "right"],
];

/** More everyday words than the visit suggestions need. Each adds words; the original is kept. */
const MORE: Record<string, string[]> = {
  ant: ["formication"], ants: ["formication"], crawling: ["formication", "crawling"],
  tingling: ["tingling", "formication"], numb: ["numbness"], prickling: ["prickling", "tingling"],
  throbbing: ["pulsating", "throbbing"], pounding: ["pulsating"], stabbing: ["stitching", "stabbing"], sharp: ["stitching", "cutting"],
  shooting: ["shooting", "darting"], aching: ["aching", "pain"], ache: ["pain"], aches: ["pain"], sore: ["sore", "bruised", "pain"],
  pee: ["urination"], peeing: ["urination"], wee: ["urination"], urinating: ["urination"],
  poop: ["stool"], pooping: ["stool"], bowel: ["stool"], bowels: ["stool"], runs: ["diarrhea"],
  burp: ["eructations"], burping: ["eructations"], belching: ["eructations"], gassy: ["flatulence"], gas: ["flatulence"], wind: ["flatulence"],
  bloated: ["distension"], bloating: ["distension"], heartburn: ["eructations", "burning", "heartburn"], reflux: ["eructations"],
  sneeze: ["sneezing"], sneezes: ["sneezing"], snot: ["discharge"], mucus: ["discharge", "mucus"], phlegm: ["expectoration"],
  cramp: ["cramping", "cramps"], cramps: ["cramping", "cramps"], shaky: ["trembling"], shaking: ["trembling"], tremor: ["trembling"],
  faint: ["fainting", "faintness"], fainting: ["faintness"], sleepy: ["sleepiness"], drowsy: ["sleepiness"],
  twitch: ["twitching"], twitches: ["twitching"], jerk: ["jerking"], jerks: ["jerking"],
  pimples: ["eruptions", "pimples"], acne: ["eruptions", "acne"], spots: ["eruptions"], hives: ["urticaria"], boil: ["boils"],
  smelly: ["offensive"], stinky: ["offensive"], smells: ["odor", "offensive"], sour: ["sour"],
  lonely: ["forsaken"], homesick: ["homesickness"], shy: ["timidity"], bossy: ["dictatorial"], stubborn: ["obstinate"],
  clingy: ["clinging"], picky: ["fastidious"], neat: ["fastidious"], tidy: ["fastidious"], touchy: ["sensitive"],
  moody: ["mood", "changeable"], lazy: ["indolence"], forgetful: ["memory", "weakness", "forgetful"], concentrate: ["concentration"],
  suicidal: ["suicidal"], panic: ["anxiety", "fear"], nervous: ["anxiety", "nervousness"], stressed: ["anxiety"], grieving: ["grief"],
  heights: ["high", "places"], crowds: ["crowd"], storm: ["thunderstorm"], storms: ["thunderstorm"], thunder: ["thunderstorm"],
  hungry: ["hunger"], starving: ["hunger"], salty: ["salt"], sweets: ["sweets"], sugar: ["sweets"], chocolate: ["chocolate"],
  chills: ["chilliness", "chill"], shivering: ["shivering", "chill"], feverish: ["fever"], flu: ["influenza"],
  nosebleed: ["epistaxis"], nosebleeds: ["epistaxis"], bleeding: ["hemorrhage", "bleeding"],
  bruise: ["bruised", "ecchymoses"], bruises: ["ecchymoses"], swollen: ["swelling"], swelling: ["swelling"],
  stiff: ["stiffness"], weakness: ["weakness"], dry: ["dryness", "dry"], thirsty: ["thirst"],
  teething: ["dentition"], colic: ["colic"], hoarse: ["hoarseness"], voice: ["voice"],
  forehead: ["forehead"], temples: ["temples"], scalp: ["scalp"], eyelids: ["lids"], eyelid: ["lids"],
  knees: ["knee"], hips: ["hip"], shoulders: ["shoulder"], hands: ["hand"], fingers: ["fingers"], toes: ["toes"], legs: ["leg"], arms: ["arm"],
  lying: ["lying"], walking: ["walking"], warm: ["warm"], heat: ["heat"], cold: ["cold", "coldness"], wet: ["wet"], damp: ["wet", "damp"],
};

const STOP = new Set(
  "i im i'm me my mine we our you your she her he his they them their it its a an the of to in on at by for from with and or but so is are was were be been being am do does did have has had feel feels feeling felt like as if very really quite always often sometimes usually gets get got when whenever that this these those there here just also too much more some any".split(
    " ",
  ),
);

const raw = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);

/** One idea typed by the user: the word and the repertory words it may appear as. */
export interface Concept {
  word: string;
  alts: string[];
}

/** Turns what was typed into ideas, each with the words a rubric may use for it. */
export function concepts(input: string): Concept[] {
  let text = ` ${raw(input).join(" ")} `;
  const added: Concept[] = [];
  for (const [phrase, words] of [...PHRASES].sort((a, b) => b[0].length - a[0].length)) {
    const p = ` ${raw(phrase).join(" ")} `;
    if (text.includes(p)) {
      text = text.replace(p, " ");
      for (const w of words.split(" ")) added.push({ word: phrase, alts: [stem(w)] });
    }
  }
  // Words from one phrase count as one idea only when they are alternatives; here each repertory word is its own idea.
  const out: Concept[] = [...added];
  for (const w of text.split(" ").filter(Boolean)) {
    if (STOP.has(w) || w.length < 2) continue;
    const st = stem(w);
    const alts = new Set([st, ...(SYNONYMS[w] ?? SYNONYMS[st] ?? []).map(stem), ...(MORE[w] ?? MORE[st] ?? []).map(stem)]);
    out.push({ word: w, alts: [...alts] });
  }
  // The same idea typed twice counts once.
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = c.alts.join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Stemmed words of every rubric, built once per repertory file. */
export function plainIndex(data: RepertoryFile): string[][] {
  return data.rubrics.map(([path]) => [...new Set(raw(path).map(stem))]);
}

const matches = (words: string[], alt: string) => words.some((w) => w === alt || (alt.length >= 4 && w.startsWith(alt)));

export interface PlainHit extends Rubric {
  /** How many of the typed ideas the rubric contains. */
  matched: number;
  of: number;
}

/**
 * Rubrics ranked by how many typed ideas they contain. With one or two ideas every idea must match;
 * with more, one may be missing, so a small difference in wording still finds the rubric.
 */
export function searchPlain(data: RepertoryFile, index: string[][], input: string, limit = 40): PlainHit[] {
  const cs = concepts(input);
  if (!cs.length) return [];
  const need = cs.length <= 2 ? cs.length : cs.length - 1;
  const hits: PlainHit[] = [];
  index.forEach((words, id) => {
    let n = 0;
    for (const c of cs) if (c.alts.some((a) => matches(words, a))) n++;
    if (n >= need) hits.push({ ...toRubric(data, id), matched: n, of: cs.length });
  });
  const depth = (p: string) => p.split(",").length;
  hits.sort((a, b) => b.matched - a.matched || depth(a.path) - depth(b.path) || b.remedyCount - a.remedyCount || a.path.localeCompare(b.path));
  return hits.slice(0, limit);
}

/** The repertory words an input turns into, for showing "Searching for: …". */
export const explain = (input: string) => concepts(input).map((c) => (c.alts.length > 1 ? c.alts.slice(0, 3).join(" / ") : c.alts[0]));

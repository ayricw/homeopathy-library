// Suggested rubrics: matches what is ticked and written on a visit's intake to repertory rubrics.
// Runs in the browser on the loaded repertory file. Nothing is sent anywhere: client records never
// leave the app (see AGENTS.md, "Client records").
//
// The rule is deliberately strict and easy to explain: a rubric is suggested when every word of it
// (apart from small words like "of" or "during") appears in one sentence of an answer, after common
// everyday words are turned into repertory words ("worse" becomes "agg", "afraid" becomes "fear").
// Its chapter (Head, Mind…) must be named in the sentence or fit the question it was written under.
// Only the most specific matching rubric on each branch is kept. Robyn adds each suggestion herself.

import type { RepertoryFile } from "./repertory";

export interface Suggestion {
  id: number;
  path: string;
  remedyCount: number;
  /** What it was found from: a tick ("Craves: Sweets") or a quoted sentence. */
  from: string;
  /** Question id the suggestion came from, for grouping. */
  question: string;
}

/** One sentence or tick to match, with the chapters its question points to. */
export interface Phrase {
  text: string;
  chapters: string[];
  from: string;
  question: string;
}

export interface SuggestIndex {
  data: RepertoryFile;
  /** Required (stemmed) words of each rubric, chapter word excluded. */
  required: string[][];
  chapter: string[];
  /** Rubric ids by each of their required words. */
  postings: Map<string, number[]>;
}

// Small words a rubric may contain that a sentence need not.
const OPTIONAL = new Set(["in", "of", "the", "from", "for", "to", "a", "an", "and", "or", "general", "while", "on", "at", "with", "when", "as", "by", "is", "be", "being", "agg's"]);

// Everyday words to the repertory's words. Each entry adds words; it never removes the original.
const SYNONYMS: Record<string, string[]> = {
  worse: ["agg"], worsen: ["agg"], aggravat: ["agg"], aggravated: ["agg"], aggravates: ["agg"],
  better: ["amel"], improve: ["amel"], improved: ["amel"], relieve: ["amel"], relieved: ["amel"], help: ["amel"], helped: ["amel"], eases: ["amel"],
  crave: ["desire"], craving: ["desire"], longs: ["desire"], wants: ["desire"], want: ["desire"], likes: ["desire"],
  hate: ["aversion"], hates: ["aversion"], dislike: ["aversion"], dislikes: ["aversion"], refuse: ["aversion"], refuses: ["aversion"],
  afraid: ["fear"], scared: ["fear"], frightened: ["fear"], phobia: ["fear"], terrified: ["fear"],
  headache: ["head", "pain"], migraine: ["head", "pain"], earache: ["ear", "pain"], stomachache: ["stomach", "pain"],
  toothache: ["teeth", "pain"], backache: ["back", "pain"], bellyache: ["abdomen", "pain"],
  belly: ["abdomen"], tummy: ["abdomen"], tooth: ["teeth"], eyes: ["eye"], ears: ["ear"],
  cry: ["weeping"], cries: ["weeping"], crying: ["weeping"], weep: ["weeping"], weeps: ["weeping"], tearful: ["weeping"], tears: ["weeping"],
  sad: ["sadness"], depressed: ["sadness"], depression: ["sadness"], low: ["sadness"],
  anxious: ["anxiety"], worry: ["anxiety"], worries: ["anxiety"], worried: ["anxiety"],
  irritable: ["irritability"], cranky: ["irritability"], angry: ["anger"],
  restless: ["restlessness"], jealous: ["jealousy"], impatient: ["impatience"], hurried: ["hurry"],
  thirsty: ["thirst"], sweat: ["perspiration"], sweats: ["perspiration"], sweating: ["perspiration"], sweaty: ["perspiration"],
  nightmare: ["dreams", "nightmares"], nightmares: ["dreams", "nightmares"], dream: ["dreams"],
  tired: ["weakness"], exhausted: ["weakness"], fatigue: ["weakness"], weak: ["weakness"],
  dizzy: ["vertigo"], dizziness: ["vertigo"], nauseous: ["nausea"], vomit: ["vomiting"], vomits: ["vomiting"],
  constipated: ["constipation"], itchy: ["itching"], itch: ["itching"], itches: ["itching"],
  insomnia: ["sleeplessness"], sleepless: ["sleeplessness"], sympathy: ["consolation"], comfort: ["consolation"], comforted: ["consolation"],
  chilly: ["heat", "vital", "lack", "chilliness"], hot: ["heat"], warmth: ["warm"], cold: ["coldness"],
  fresh: ["open"], outdoors: ["open", "air"], outside: ["open", "air"], periods: ["menses"], period: ["menses"], menstruation: ["menses"],
  touched: ["touch"], moving: ["motion"], movement: ["motion"], lie: ["lying"], lies: ["lying"],
  while: ["during"], feet: ["foot"], foot: ["foot"], calves: ["calf"], calf: ["calf"],
  talks: ["talking"], talk: ["talking"], grinds: ["grinding"], grind: ["grinding"],
};

// Words that point to a chapter even when it is not written out.
const CHAPTER_WORDS: Record<string, string[]> = {
  Head: ["head", "headache", "migraine", "scalp", "forehead"],
  Ear: ["ear", "ears", "earache"],
  Hearing: ["hearing", "deaf"],
  Eye: ["eye", "eyes", "eyelid", "eyelids"],
  Vision: ["vision", "sight", "seeing"],
  Nose: ["nose", "nasal", "sinus", "sinuses", "sneezing", "coryza"],
  Face: ["face", "lips", "jaw", "cheek", "cheeks"],
  Mouth: ["mouth", "tongue", "gums", "saliva", "taste"],
  Teeth: ["teeth", "tooth", "toothache"],
  Throat: ["throat", "tonsils", "swallowing"],
  "External throat": ["neck", "thyroid", "glands"],
  "Larynx and trachea": ["voice", "hoarse", "hoarseness", "larynx"],
  Chest: ["chest", "breast", "breasts", "lungs"],
  "Heart & Circulation": ["heart", "palpitation", "palpitations", "pulse"],
  Cough: ["cough", "coughing", "coughs"],
  Respiration: ["breathing", "breath", "breathe", "asthma", "wheezing"],
  Expectoration: ["expectoration", "phlegm", "mucus"],
  Stomach: ["stomach", "nausea", "nauseous", "vomiting", "vomit", "thirst", "thirsty", "thirstless", "heartburn", "reflux", "eructations", "burping"],
  Abdomen: ["abdomen", "belly", "tummy", "bloating", "bloated", "flatulence", "gas", "colic"],
  Stool: ["stool", "stools", "diarrhea", "diarrhoea", "constipation", "constipated", "poop"],
  Rectum: ["rectum", "hemorrhoids", "haemorrhoids", "anus", "constipation", "diarrhea", "diarrhoea"],
  Bladder: ["bladder", "urination", "urinate", "urinating", "bedwetting"],
  Urine: ["urine"],
  Kidneys: ["kidney", "kidneys"],
  Back: ["back", "spine", "backache"],
  Extremities: ["arm", "arms", "leg", "legs", "hand", "hands", "foot", "feet", "joint", "joints", "knee", "knees", "hip", "hips", "shoulder", "shoulders", "fingers", "toes", "limbs", "wrist", "ankle", "ankles"],
  Skin: ["skin", "rash", "eczema", "eruptions", "itching", "itchy", "hives", "warts"],
  Sleep: ["sleep", "sleeping", "asleep", "dreams", "dream", "insomnia", "sleepless", "nightmares", "yawning"],
  Perspiration: ["perspiration", "sweat", "sweats", "sweating", "sweaty"],
  Appetite: ["appetite", "craves", "craving", "cravings", "desires", "aversion", "hungry", "hunger"],
  "Genitalia female": ["menses", "period", "periods", "menstruation", "uterus", "vagina", "vaginal", "ovaries", "leucorrhea"],
  "Genitalia male": ["erection", "erections", "testes", "penis"],
  "Prostate gland": ["prostate"],
  Vertigo: ["vertigo", "dizzy", "dizziness"],
  Fever: ["fever", "fevers", "feverish"],
  Chill: ["chill", "chills", "chilliness", "shivering"],
  Mind: ["fear", "fears", "afraid", "anxiety", "anxious", "weeping", "crying", "grief", "irritability", "irritable", "anger", "angry", "sadness", "sad", "depressed", "jealousy", "jealous", "consolation", "company", "alone", "restlessness", "memory", "concentration", "mood", "fastidious"],
};

// Which chapters each question's answers belong to. Questions not listed (complaints, history)
// rely on the words written.
const QUESTION_CHAPTERS: Record<string, string[]> = {
  head: ["Head"], eyes: ["Eye", "Vision"], ears: ["Ear", "Hearing"], nose: ["Nose"], face: ["Face"],
  mouth: ["Mouth", "Teeth"], throat: ["Throat", "Larynx and trachea"], "neck-glands": ["External throat"],
  chest: ["Chest", "Cough", "Respiration", "Expectoration"], heart: ["Heart & Circulation"],
  stomach: ["Stomach"], abdomen: ["Abdomen"], stool: ["Stool", "Rectum"], urinary: ["Bladder", "Urine", "Kidneys", "Urethra"],
  urine: ["Bladder", "Urine"], back: ["Back"], limbs: ["Extremities"], nerves: ["Extremities"], neuro: ["Extremities", "Mind"],
  skin: ["Skin"], vertigo: ["Vertigo"], digestion: ["Stomach", "Abdomen"],
  sleep: ["Sleep"], "sleep-position": ["Sleep"], "in-sleep": ["Sleep", "Teeth", "Mind"], dreams: ["Sleep"],
  sweat: ["Perspiration"], appetite: ["Appetite", "Stomach"], cravings: ["Appetite"], aversions: ["Appetite"],
  "food-worse": ["Generalities", "Stomach"], thirst: ["Stomach", "Appetite"], drinks: ["Appetite"], diet: ["Appetite"],
  cycle: ["Genitalia female"], "menses-mood": ["Genitalia female", "Mind"], menopause: ["Genitalia female"], "female-other": ["Genitalia female"],
  men: ["Genitalia male", "Prostate gland"],
  "life-now": ["Mind"], traumas: ["Mind"], stress: ["Mind"], fears: ["Mind"], anger: ["Mind"], weeping: ["Mind"],
  consolation: ["Mind"], traits: ["Mind"], personality: ["Mind"], "mind-concentration": ["Mind"], mood: ["Mind"],
  "mind-acute": ["Mind"], "when-ill": ["Mind"], unusual: ["Mind"], "baby-personality": ["Mind"], observed: ["Mind"], observations: ["Mind"],
  cause: ["Mind", "Generalities"],
};

// Ticks become a sentence in repertory words.
const TICK_WORDS: Record<string, (o: string) => string> = {
  cravings: (o) => `desires ${o}`,
  aversions: (o) => `aversion ${o}`,
  fears: (o) => `fear ${o}`,
  worse: (o) => `${o} agg`,
  better: (o) => `${o} amel`,
  time: (o) => `${o} agg`,
  weather: (o) => `${o} agg`,
  cause: (o) => `ailments from ${o}`,
  sensitive: (o) => `sensitive ${o}`,
  "sleep-position": (o) => `position ${o}`,
  sweat: (o) => `perspiration ${o}`,
  season: (o) => `${o} agg`,
};

// Ticks whose words are not the repertory's.
const TICK_OVERRIDES: Record<string, string> = {
  "weather:Damp cold": "cold wet weather agg",
  "weather:Wet": "wet weather agg",
  "thermal:Chilly": "heat vital lack",
  "thermal:Warm": "warm agg",
  "thermal:Hot": "heat",
  "thermal:Hands and feet cold": "extremities coldness hands feet",
  "thermal:Burning feet at night": "extremities burning feet night",
  "thirst:Very thirsty": "thirst",
  "thirst:Little thirst": "thirstless",
  "thirst:Large amounts": "thirst large quantities",
  "thirst:Small sips often": "thirst small quantities often",
  "thirst:Ice cold drinks": "desires cold drinks",
  "thirst:Cold drinks": "desires cold drinks",
  "thirst:Warm drinks": "desires warm drinks",
  "thirst:Hot drinks": "desires hot drinks",
  "consolation:Better from consolation": "consolation amel",
  "consolation:Worse from consolation": "consolation agg",
  "consolation:Dislikes being fussed over": "consolation agg",
  "consolation:Wants to be held": "desire carried",
  "consolation:Wants to be left alone": "company aversion",
  "when-ill:Better from consolation": "consolation amel",
  "when-ill:Worse from consolation": "consolation agg",
  "when-ill:Wants to be left alone": "company aversion",
  "when-ill:Wants to be held": "desire carried",
  "traits:Likes company": "company desire",
  "traits:Prefers to be alone": "company aversion",
  "traits:Weeps easily": "weeping easily",
  "traits:Cannot weep": "weeping cannot",
  "traits:Hurried, impatient": "hurry impatience",
  "traits:Quick to anger": "anger",
  "traits:Holds anger in": "anger suppressed",
  "traits:Sensitive to criticism": "sensitive reprimand",
  "traits:Fastidious, orderly": "fastidious",
  "traits:Worrier": "anxiety",
  "traits:Lacks confidence": "confidence want self",
  "cravings:Salt": "desires salt things",
  "aversions:Salt": "aversion salt things",
  "aversions:Fat": "aversion food fat",
  "cravings:Cold drinks": "desires cold drinks",
  "cravings:Cold food": "desires cold food",
  "cravings:Warm food": "desires warm food",
  "in-sleep:Talks": "talking sleep",
  "in-sleep:Grinds teeth": "teeth grinding sleep during",
  "in-sleep:Restless": "sleep restless",
  "in-sleep:Kicks off covers": "uncovering sleep",
  "in-sleep:Eyes half open": "eyes half open sleep",
  "in-sleep:Sweats": "perspiration sleep during",
  "in-sleep:Startles": "sleep starting",
  "in-sleep:Sleepwalks": "somnambulism",
  "sweat:A lot": "perspiration profuse",
  "sweat:Little": "perspiration scanty",
  "sweat:At night": "perspiration night",
  "sweat:Offensive smell": "perspiration offensive",
  "sweat:Sour smell": "perspiration sour",
  "sweat:Cold sweat": "perspiration cold",
  "sweat:Head": "head perspiration",
  "sweat:Palms": "hands perspiration palms",
  "sweat:Feet": "feet perspiration",
  "covers:No covers": "uncovering amel",
  "covers:Feet out": "uncovering feet amel",
  "covers:Fully covered": "covering desire",
  "cause:Anxiety or worry": "ailments from anxiety",
  "cause:Loss of a loved one": "ailments from death loved",
  "cause:Disappointed love": "ailments from love disappointed",
  "cause:Suppressed anger": "ailments from anger suppressed",
  "cause:Getting wet": "wet getting agg",
  "cause:Loss of sleep": "loss of sleep agg",
  "cause:Injury or fall": "injuries",
  "cause:Head injury": "injuries head",
  "sea-mountains:Better at the sea": "seashore amel",
  "sea-mountains:Worse at the sea": "seashore agg",
  "sea-mountains:Better in mountains": "mountains amel",
  "sea-mountains:Worse in mountains": "mountains agg",
};

const NEGATIONS = new Set(["not", "no", "never", "without", "dont", "don't", "doesnt", "doesn't", "isnt", "isn't", "cannot't", "nor", "hardly"]);

const raw = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);

/** A light stemmer, applied the same way to rubrics and answers. */
export function stem(w: string): string {
  w = w.replace(/'s$/, "").replace(/'/g, "");
  if (w === "feet") return "foot";
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}

/** Builds the lookup once per repertory file. */
export function buildSuggestIndex(data: RepertoryFile): SuggestIndex {
  const required: string[][] = [];
  const chapter: string[] = [];
  const postings = new Map<string, number[]>();
  data.rubrics.forEach(([path], id) => {
    const parts = path.split(",");
    chapter[id] = parts[0].trim();
    const req = [...new Set(raw(parts.slice(1).join(" ")).filter((w) => !OPTIONAL.has(w)).map(stem))];
    required[id] = req;
    for (const w of req) {
      let list = postings.get(w);
      if (!list) postings.set(w, (list = []));
      list.push(id);
    }
  });
  return { data, required, chapter, postings };
}

/** The words a sentence offers: its own words, minus negated ones, plus repertory synonyms, all stemmed. */
function phraseWords(text: string): { words: Set<string>; plain: string[] } {
  const plain = raw(text);
  const out = new Set<string>();
  for (let i = 0; i < plain.length; i++) {
    const w = plain[i];
    if (NEGATIONS.has(w)) {
      i++; // skip the word the negation applies to
      continue;
    }
    out.add(stem(w));
    for (const s of SYNONYMS[w] ?? []) out.add(stem(s));
  }
  return { words: out, plain };
}

export function matchPhrase(index: SuggestIndex, phrase: Phrase, perPhrase = 4): Suggestion[] {
  const { words, plain } = phraseWords(phrase.text);
  if (!words.size) return [];
  const allowed = new Set(["Generalities", ...phrase.chapters]);
  for (const [chapter, triggers] of Object.entries(CHAPTER_WORDS)) if (triggers.some((t) => plain.includes(t))) allowed.add(chapter);

  const seen = new Set<number>();
  const hits: number[] = [];
  for (const w of words) {
    for (const id of index.postings.get(w) ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      const req = index.required[id];
      if (req.length && allowed.has(index.chapter[id]) && req.every((r) => words.has(r))) hits.push(id);
    }
  }
  // Drop a rubric when another match covers all its words and more (Ear, pain, burning beats
  // Generalities, pain), or the same words in a named body part rather than Generalities.
  const covers = (big: number, small: number) => {
    const b = index.required[big];
    const a = index.required[small];
    if (!a.every((w) => b.includes(w))) return false;
    if (b.length > a.length) return true;
    if (index.chapter[small] === "Generalities" && index.chapter[big] !== "Generalities") return true;
    // The same words in the same chapter: keep the shorter heading ("Mind, grief, ailments" over "…, from").
    const pb = index.data.rubrics[big][0];
    const pa = index.data.rubrics[small][0];
    return index.chapter[small] === index.chapter[big] && (pb.length < pa.length || (pb.length === pa.length && big < small));
  };
  const leaves = hits.filter((id) => !hits.some((other) => other !== id && covers(other, id)));
  leaves.sort(
    (a, b) =>
      index.required[b].length - index.required[a].length ||
      Number(phrase.chapters.includes(index.chapter[b])) - Number(phrase.chapters.includes(index.chapter[a])) ||
      index.data.rubrics[b][1].length - index.data.rubrics[a][1].length,
  );
  return leaves.slice(0, perPhrase).map((id) => ({
    id,
    path: index.data.rubrics[id][0],
    remedyCount: index.data.rubrics[id][1].length,
    from: phrase.from,
    question: phrase.question,
  }));
}

/** The base question id: "c2-worse" and "c3-worse" answer "worse". */
const baseId = (id: string) => id.replace(/^c\d+-/, "").replace(/-more$/, "");

/** Turns a visit's answers into phrases to match: one per tick, one per written sentence. */
export function phrasesFromAnswers(
  answers: Record<string, string>,
  questions: { id: string; label: string; options?: string[] }[],
  separator: string,
): Phrase[] {
  const phrases: Phrase[] = [];
  const byId = new Map(questions.map((q) => [q.id, q]));
  for (const [id, value] of Object.entries(answers)) {
    if (!value.trim()) continue;
    const base = baseId(id);
    const q = byId.get(id);
    const chapters = QUESTION_CHAPTERS[base] ?? [];
    if (q?.options) {
      for (const tick of value.split(separator)) {
        const text = TICK_OVERRIDES[`${base}:${tick}`] ?? TICK_WORDS[base]?.(tick) ?? tick;
        phrases.push({ text, chapters, from: `${q.label}: ${tick}`, question: id });
      }
    } else {
      for (const sentence of value.split(/[.;!?\n]+/)) {
        const s = sentence.trim();
        if (s.length < 3) continue;
        phrases.push({ text: s, chapters, from: `“${s.length > 70 ? `${s.slice(0, 67)}…` : s}”`, question: id });
      }
    }
  }
  return phrases;
}

/** Suggestions for a whole visit, best first, each rubric once. */
export function suggestRubrics(index: SuggestIndex, phrases: Phrase[], limit = 60): Suggestion[] {
  const out: Suggestion[] = [];
  const taken = new Set<number>();
  for (const p of phrases) {
    for (const s of matchPhrase(index, p)) {
      if (taken.has(s.id)) continue;
      taken.add(s.id);
      out.push(s);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

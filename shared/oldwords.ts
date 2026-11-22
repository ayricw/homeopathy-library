// The books are 100 to 150 years old and use the words of their time: "anguish" and "fear of death"
// rather than "panic attack", "sleeplessness" rather than "insomnia", British spellings such as
// "diarrhoea". When a search uses a modern word, these older words are searched as well.
import { buildMatchQuery } from "./query";

/** [modern words (lower case), [older word as shown, its FTS5 query]...] */
const OLD_WORDS: [RegExp, [string, string][]][] = [
  [/\bpanic/, [["anxiety", '"anxi"*'], ["anguish", '"anguish"*'], ["terror", '"terror"*'], ["fear of death", '"fear" "death"']]],
  [/\banxi/, [["anguish", '"anguish"*'], ["apprehension", '"apprehensi"*']]],
  [/\bdepress/, [["sadness", '"sadness"'], ["melancholy", '"melanchol"*'], ["despair", '"despair"*'], ["low spirits", '"low spirit"*']]],
  [/\binsomnia|\bcan'?t sleep|\bcannot sleep/, [["sleeplessness", '"sleepless"*']]],
  [/\bheartburn|\breflux/, [["heartburn", '"heartburn"'], ["pyrosis", '"pyrosis"'], ["sour eructations", '"eructation"* "sour"']]],
  [/\bmigraine/, [["hemicrania", '"hemicrania"'], ["sick headache", '"sick headache"*']]],
  [/\badhd\b|\bhyperactiv/, [["restlessness", '"restless"*'], ["hurried", '"hurried"']]],
  [/\bdiarrhea/, [["diarrhoea", '"diarrh"*']]],
  [/\banemi/, [["anaemia", '"anaemi"*']]],
  [/\bedema/, [["oedema", '"oedema"*']]],
  [/\bhemorrhag/, [["haemorrhage", '"haemorrhag"*']]],
  [/\bhot flash/, [["flushes of heat", '"flush"*']]],
  [/\btired|\bfatigue|\bexhaust/, [["weariness", '"weari"*'], ["prostration", '"prostrat"*'], ["lassitude", '"lassitude"']]],
  [/\bdizz/, [["vertigo", '"vertigo"']]],
  [/\bbloat/, [["distension", '"distension"'], ["flatulence", '"flatulen"*']]],
  [/\bperiod pain|\bmenstrual cramp|\bpainful period/, [["dysmenorrhoea", '"dysmenorrh"*'], ["painful menses", '"menses" "pain"*']]],
  [/\bpms\b|\bpremenstrual/, [["before menses", '"before" "menses"']]],
  [/\buti\b|\bbladder infection/, [["cystitis", '"cystitis"']]],
  [/\beczema/, [["eruptions", '"eruption"*'], ["tetter", '"tetter"*']]],
  [/\bacne\b/, [["pimples", '"pimple"*']]],
  [/\bmiscarriage/, [["abortion (old word)", '"abortion"*']]],
  [/\bracing heart|\bheart racing|\bpalpitations?\b/, [["palpitation", '"palpitation"*']]],
  [/\bocd\b|\bobsessive/, [["fastidious", '"fastidious"']]],
  [/\bstroke\b/, [["apoplexy", '"apoplex"*']]],
  [/\barthritis/, [["rheumatism", '"rheumat"*'], ["gout", '"gout"*']]],
  [/\bflu\b/, [["influenza", '"influenza"'], ["grippe", '"grippe"']]],
  [/\bsinus/, [["coryza", '"coryza"'], ["catarrh", '"catarrh"*']]],
  [/\bbed ?wetting|\bwets the bed/, [["enuresis", '"enuresis"'], ["involuntary urination", '"urin"* "involuntar"*']]],
  [/\bteething/, [["dentition", '"dentition"']]],
];

/** The older words searched for what was typed (none when it has no modern word on the list). */
export function olderWords(input: string): [string, string][] {
  const text = input.toLowerCase();
  const out: [string, string][] = [];
  for (const [re, words] of OLD_WORDS) if (re.test(text)) for (const w of words) if (!out.some((o) => o[1] === w[1])) out.push(w);
  return out;
}

/** The FTS5 query for what was typed, OR the older words; and the older words, for showing. */
export function expandedMatch(input: string): { match: string | null; also: string[] } {
  const base = buildMatchQuery(input);
  if (!base) return { match: null, also: [] };
  const older = olderWords(input);
  if (!older.length) return { match: base, also: [] };
  return { match: [base, ...older.map(([, q]) => q)].map((q) => `(${q})`).join(" OR "), also: older.map(([w]) => w) };
}

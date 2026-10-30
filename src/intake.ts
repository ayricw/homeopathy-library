import type { VisitKind } from "../shared/clients";

// The forms for each kind of visit. The full intakes follow the order of a classical new-client case:
// main complaints, past and family history, birth and childhood, generals (weather, food, sleep, sweat),
// every part of the body, women's or men's health, mind and emotions, then the practitioner's own
// observations, the sensation process and the plan. They draw on published new-client questionnaires
// (Sankaran's case record, HomeoWorks, New Life Homeopathy, Bastyr's homeopathic generals form) and
// the School of Intuitive Homeopathy's intake forms and case-taking summary.
//
// The questions are kept here, not stored: a visit saves only the answers, by question id, so wording
// can change without touching saved visits. Never reuse an id for a different question.
// A question with options is answered by ticking them; the ticks are saved as one text, joined by "; ",
// and details go in a box under it saved as `<id>-more`.

export interface Question {
  id: string;
  label: string;
  /** Prompts shown under the question. */
  hint?: string;
  /** Tick-list answers. Must not contain "; ". */
  options?: string[];
  /** Taller box for long answers. */
  long?: boolean;
}

export interface Section {
  title: string;
  questions: Question[];
  /** Starts folded, for sections many visits will not need. */
  folded?: boolean;
}

export const KIND_LABEL: Record<VisitKind, string> = {
  adult: "Full intake (adult)",
  child: "Full intake (child)",
  followup: "Follow-up",
  acute: "Acute",
};

export const OPTION_SEPARATOR = "; ";

// ---------- shared lists ----------

const CAUSES = [
  "Grief", "Fright", "Shock", "Disappointment", "Disappointed love", "Anger", "Suppressed anger", "Humiliation",
  "Reprimand", "Anxiety or worry", "Bad news", "Loss of a loved one", "Financial loss", "Overwork", "Mental exertion",
  "Loss of sleep", "Injury or fall", "Head injury", "Surgery", "Childbirth", "Getting wet", "Cold exposure",
  "Heat or sun", "Change of weather", "Vaccination", "Medication", "Antibiotics", "Illness or infection",
  "Food or drink", "Alcohol or drugs", "Moving home", "Relationship break-up",
];

const MODALITIES = [
  "Heat", "Cold", "Open air", "Warm room", "Stuffy room", "Wet weather", "Dry weather", "Wind", "Storms",
  "Change of weather", "Sun", "Seashore", "Mountains", "Motion", "Rest", "Walking", "Lying down", "Sitting",
  "Standing", "Pressure", "Touch", "Rubbing", "Bathing", "Eating", "Fasting", "Drinking", "Cold drinks", "Warm drinks",
  "Company", "Being alone", "Consolation", "Music", "Noise", "Light", "Darkness", "Sleep", "On waking",
  "Before menses", "During menses", "Emotions", "Exertion", "Thinking about it",
];

const TIMES = [
  "On waking", "Morning", "Forenoon", "Noon", "Afternoon", "Evening", "Twilight", "Night", "Before midnight",
  "Midnight", "After midnight", "Spring", "Summer", "Autumn", "Winter", "Full moon", "New moon",
];

const CONDITIONS = [
  "Allergies", "Asthma", "Eczema or skin disease", "Hives", "Hay fever", "Cancer", "Diabetes", "Thyroid disease",
  "High blood pressure", "Heart disease", "Stroke", "Anemia", "Bleeding disorder", "Kidney disease", "Liver disease",
  "Gallbladder disease", "Arthritis or rheumatism", "Autoimmune disease", "Epilepsy or seizures", "Migraines",
  "Tuberculosis", "Pneumonia", "Repeated strep", "Herpes", "Lyme", "Chronic fatigue", "Mold illness",
  "Sexually transmitted disease", "Depression", "Anxiety", "Bipolar disorder", "Schizophrenia", "Alcohol or drug abuse",
  "Dementia", "Obesity",
];

const PAST_ILLNESSES = [
  "Measles", "German measles", "Chicken pox", "Mumps", "Whooping cough", "Scarlet fever", "Glandular fever (mono)",
  "Frequent colds", "Ear infections", "Tonsillitis", "Sinusitis", "Bronchitis", "Pneumonia", "Asthma", "Pleurisy",
  "Tuberculosis", "Meningitis", "Malaria", "Typhoid", "Dysentery", "Food poisoning", "Worms or parasites", "Jaundice",
  "Hepatitis", "Urinary infections", "Kidney stones", "Gallstones", "Appendicitis", "Shingles", "Cold sores",
  "Warts", "Boils", "Acne", "Eczema", "Psoriasis", "Ringworm or fungus", "Concussion", "Fractures",
];

const WEATHER = ["Cold", "Heat", "Damp cold", "Dry cold", "Wet", "Dry", "Wind", "Storms or thunder", "Fog", "Hot sun", "Cloudy", "Change of weather", "Drafts"];

const SENSITIVE_TO = ["Bright light", "Darkness", "Noise", "Music", "Odors", "Touch", "Pain", "Tight clothing", "Stuffy rooms", "Open air", "Drafts", "Electricity or screens"];

const COVERS = ["No covers", "Partly covered", "Fully covered", "Covers over the head", "Feet out", "Arms or legs out", "Fan or air on them", "Window open"];

const TASTES_AND_FOODS = [
  "Sweets", "Chocolate", "Salt", "Sour", "Spicy", "Bitter", "Fat", "Butter", "Meat", "Fish", "Eggs", "Milk", "Cheese",
  "Ice cream", "Bread", "Pasta or starches", "Fruit", "Juicy things", "Vegetables", "Onions", "Garlic", "Pickles",
  "Vinegar", "Lemons", "Coffee", "Tea", "Alcohol", "Beer", "Wine", "Cold drinks", "Ice", "Warm food", "Cold food",
  "Smoked food", "Spices", "Indigestible things (chalk, dirt)",
];

const THIRST = ["Very thirsty", "Little thirst", "Thirstless", "Large amounts", "Small sips often", "Ice cold drinks", "Cold drinks", "Room temperature", "Warm drinks", "Hot drinks"];

const SLEEP_POSITIONS = ["Right side", "Left side", "Back", "Stomach", "Knees to chest", "Arms above head", "Hands under head", "Curled up"];

const IN_SLEEP = ["Talks", "Grinds teeth", "Snores", "Moans", "Cries", "Laughs", "Startles", "Sleepwalks", "Eyes half open", "Drools", "Restless", "Kicks off covers", "Sweats", "Wakes at the same hour"];

const FEARS = [
  "Being alone", "The dark", "Death", "Death of loved ones", "Disease", "Cancer", "Heights", "Crowds", "Narrow places",
  "Water", "Thunderstorms", "Wind", "Fire", "Robbers", "Ghosts", "Animals", "Dogs", "Snakes", "Spiders", "Insects",
  "Poverty", "Failure", "Public speaking", "Being looked at", "Going insane", "Something bad will happen",
  "Flying", "Driving", "Doctors or dentists", "Needles", "Being poisoned", "Being abandoned",
];

const TRAITS = [
  "Fastidious, orderly", "Messy", "Hurried, impatient", "Slow", "Restless", "Calm", "Anxious", "Worrier",
  "Irritable", "Quick to anger", "Holds anger in", "Weeps easily", "Cannot weep", "Sympathetic", "Sensitive to criticism",
  "Sensitive to injustice", "Self-critical", "Critical of others", "Lacks confidence", "Proud", "Ambitious",
  "Competitive", "Indecisive", "Jealous", "Suspicious", "Secretive", "Talkative", "Reserved", "Likes company",
  "Prefers to be alone", "Independent", "Yielding", "Bossy", "Stubborn", "Conscientious", "Perfectionist",
  "Thrifty", "Generous", "Romantic", "Religious or spiritual", "Loves animals", "Loves music", "Loves dancing",
];

const CONSOLATION = ["Better from consolation", "Worse from consolation", "Dislikes being fussed over", "Wants to be held", "Wants to talk it through", "Wants to be left alone"];

const OBSERVED = ["Chilly", "Warm", "Restless", "Still", "Talkative", "Reserved", "Weepy", "Laughs a lot", "Hurried speech", "Slow speech", "Precise", "Vague", "Animated gestures", "Guarded", "Warm and open", "Tidy appearance", "Untidy appearance"];

// ---------- sections used by more than one form ----------

const SENSATION: Section = {
  title: "Sensation process",
  questions: [
    {
      id: "sensation",
      label: "Sensation process",
      hint: "Eyes closed, breathing, connected to the body: how do you feel in your body? Tell me more. Note their exact, unusual and repeated words, gestures, images, and how times of trauma felt.",
      long: true,
    },
  ],
};

const CLOSE: Section = {
  title: "Remedies and plan",
  questions: [
    { id: "strange-rare", label: "Strange, rare and peculiar symptoms", hint: "What is unique to this person." },
    { id: "remedy-ideas", label: "Remedies that came to mind during the case" },
    { id: "plan", label: "Dosing plan and instructions sent", hint: "And when to follow up (usually 3 to 6 weeks)." },
  ],
};

const complaint = (n: number, label: string): Question[] => {
  const p = n === 1 ? "" : `c${n}-`;
  return [
    { id: `${p}main-complaint`, label, hint: n === 1 ? "In their own words, with a timeline of notable symptoms and events." : undefined, long: n === 1 },
    { id: `${p}onset`, label: "When did it begin, and what was happening in their life then?" },
    { id: `${p}cause`, label: "What it started from (ailments from)", options: CAUSES },
    { id: `${p}location`, label: "Location and extension", hint: "Exactly where; side; does it spread or move, and in which direction?" },
    { id: `${p}sensation-desc`, label: "Sensation", hint: "In their own words: burning, stitching, pressing, throbbing, like a band, like a splinter…" },
    { id: `${p}worse`, label: "Worse from", options: MODALITIES },
    { id: `${p}better`, label: "Better from", options: MODALITIES },
    { id: `${p}time`, label: "Time it is worst", hint: "Give an hour if they can.", options: TIMES },
    { id: `${p}concomitants`, label: "What else happens with it", hint: "Symptoms that come at the same time, discharges and their colour, consistency and smell." },
  ];
};

const GENERALS: Section = {
  title: "Generals: weather, temperature and senses",
  questions: [
    { id: "thermal", label: "Hot or chilly", options: ["Chilly", "Warm", "Changes", "Hands and feet cold", "Hands and feet hot", "Burning feet at night"] },
    { id: "weather", label: "Troubled by", options: WEATHER },
    { id: "season", label: "Season they feel worst", options: ["Spring", "Summer", "Autumn", "Winter"] },
    { id: "sea-mountains", label: "At the seashore or in the mountains", options: ["Better at the sea", "Worse at the sea", "Better in mountains", "Worse in mountains"] },
    { id: "sensitive", label: "Sensitive to", options: SENSITIVE_TO },
    { id: "covers", label: "How they sleep under the covers", options: COVERS },
    { id: "energy", label: "Energy through the day", hint: "When it is best and worst; how they recover from exertion." },
  ],
};

const FOOD: Section = {
  title: "Generals: food and drink",
  questions: [
    { id: "appetite", label: "Appetite", hint: "When hungry; what happens if a meal is missed; eating fast or slow; full quickly; hungry at night." },
    { id: "cravings", label: "Craves", hint: "Natural desires, not what they think is healthy.", options: TASTES_AND_FOODS },
    { id: "aversions", label: "Dislikes or refuses", options: TASTES_AND_FOODS },
    { id: "food-worse", label: "Foods that disagree", hint: "And what happens." },
    { id: "thirst", label: "Thirst", options: THIRST },
    { id: "drinks", label: "What they drink in a day", hint: "Water, coffee, tea, alcohol, soda." },
  ],
};

const SLEEP: Section = {
  title: "Generals: sleep and dreams",
  questions: [
    { id: "sleep", label: "Sleep", hint: "Falling asleep, waking (what hour, why), refreshed or not, naps, how they feel on waking." },
    { id: "sleep-position", label: "Position", options: SLEEP_POSITIONS },
    { id: "in-sleep", label: "In sleep they", options: IN_SLEEP },
    { id: "dreams", label: "Dreams", hint: "Recurring dreams, themes, nightmares, from childhood on.", long: true },
  ],
};

const SWEAT: Section = {
  title: "Generals: perspiration",
  questions: [
    { id: "sweat", label: "Perspiration", options: ["Little", "A lot", "Head", "Neck", "Armpits", "Palms", "Feet", "Chest", "At night", "On exertion", "When anxious", "Sour smell", "Offensive smell", "Stains yellow", "Cold sweat"] },
  ],
};

const HEAD_TO_TOE: Section = {
  title: "Head to toe",
  questions: [
    { id: "vertigo", label: "Vertigo, faintness" },
    { id: "head", label: "Head and headaches", hint: "Location, sensation, what brings them on, time, what helps." },
    { id: "eyes", label: "Eyes and vision" },
    { id: "ears", label: "Ears and hearing", hint: "Infections, ringing, discharge, wax." },
    { id: "nose", label: "Nose, sinuses, colds", hint: "How colds start and go; discharges; smell; nosebleeds." },
    { id: "face", label: "Face, lips, jaw" },
    { id: "mouth", label: "Mouth, tongue, teeth, gums, taste", hint: "Ulcers, bleeding gums, tooth decay, fillings (amalgam), taste in mouth, saliva." },
    { id: "throat", label: "Throat, tonsils, voice, swallowing" },
    { id: "neck-glands", label: "Neck, thyroid, glands" },
    { id: "chest", label: "Chest, breathing, cough", hint: "Time of cough, what brings it on, expectoration." },
    { id: "heart", label: "Heart and circulation", hint: "Palpitations, blood pressure, varicose veins, cold or blue extremities." },
    { id: "stomach", label: "Stomach", hint: "Nausea, vomiting, reflux, burping, pain, how they are after eating." },
    { id: "abdomen", label: "Abdomen", hint: "Gas, bloating, cramps, rumbling, liver or gallbladder." },
    { id: "stool", label: "Stool and rectum", hint: "How often, consistency, colour, urging, straining, constipation, diarrhoea, haemorrhoids, itching." },
    { id: "urinary", label: "Urine, bladder, kidneys", hint: "Frequency, at night, urging, burning, infections, smell." },
    { id: "back", label: "Neck and back" },
    { id: "limbs", label: "Limbs and joints", hint: "Pains, stiffness, swelling, cramps, restless legs, cold or hot hands and feet." },
    { id: "nerves", label: "Nerves", hint: "Numbness, tingling, twitching, tremors, tics, weakness, seizures." },
    { id: "skin", label: "Skin, hair and nails", hint: "Eruptions, itching, warts, moles, scars, how wounds heal, hair loss, nail changes." },
  ],
};

const MIND: Section = {
  title: "Mind and emotions",
  questions: [
    { id: "life-now", label: "Their life now", hint: "Work, home, relationships; what is bothering them most.", long: true },
    { id: "traumas", label: "Griefs, shocks and traumas", hint: "Losses, heartbreaks, disappointments, abuse, frights; at what age and how it felt. Never well since?", long: true },
    { id: "stress", label: "What stresses them most, and how they react or cope" },
    { id: "fears", label: "Fears", hint: "In the box: worries in their words, how strong, what they do when afraid.", options: FEARS },
    { id: "anger", label: "Anger", hint: "What makes them angry; do they show it or hold it in; afterwards?" },
    { id: "weeping", label: "Weeping", hint: "Easily or hardly ever; alone or in company; from what (music, films, telling their story)?" },
    { id: "consolation", label: "When upset", options: CONSOLATION },
    { id: "traits", label: "Traits they recognise in themselves", options: TRAITS },
    { id: "personality", label: "How they describe themselves; how others describe them" },
    { id: "mind-concentration", label: "Memory and concentration", hint: "Mistakes in speaking, writing, spelling; forgetfulness." },
    { id: "mood", label: "Mood", hint: "Changeable or steady; better or worse at a time of day; depression; hopelessness or thoughts of death." },
    { id: "enjoy", label: "What brings them most joy; where they are most in their element", hint: "Hobbies, music, nature, work." },
    { id: "spiritual", label: "Spiritual or religious life" },
    { id: "sexuality", label: "Sexual desire and relationships" },
  ],
};

// ---------- the forms ----------

const ADULT: Section[] = [
  {
    title: "About them",
    questions: [
      { id: "occupation", label: "Occupation" },
      { id: "household", label: "Home and family", hint: "Who they live with, partner, children." },
      { id: "goals", label: "What they hope homeopathy will help with" },
    ],
  },
  { title: "Main complaint", questions: complaint(1, "Main complaint") },
  { title: "Second complaint", questions: complaint(2, "Second complaint"), folded: true },
  { title: "Third complaint", questions: complaint(3, "Third complaint"), folded: true },
  {
    title: "Medical history",
    questions: [
      { id: "past-illnesses", label: "Past illnesses", options: PAST_ILLNESSES },
      { id: "history", label: "Other illnesses and diagnoses", hint: "With dates. Any illness had twice or very severely; skin eruptions treated with creams.", long: true },
      { id: "surgeries", label: "Surgeries, hospital stays, anaesthesia" },
      { id: "injuries", label: "Accidents and injuries", hint: "Head injuries, loss of consciousness, major bleeding." },
      { id: "vaccinations", label: "Vaccinations and any reactions" },
      { id: "medications", label: "Current medications", hint: "What for, dose, how long." },
      { id: "long-term-meds", label: "Medications taken over a longer term in the past", hint: "Steroids, birth control, antibiotics, antidepressants, acid blockers." },
      { id: "supplements", label: "Supplements, herbs and homeopathic remedies", hint: "Past remedies, potencies, and any aggravations." },
      { id: "substances", label: "Alcohol, tobacco, recreational drugs, addiction" },
      { id: "allergies", label: "Allergies", hint: "Food, drug, environmental; what the reaction is like." },
      { id: "labs", label: "Lab tests and other findings" },
      { id: "other-therapies", label: "Other practitioners and therapies" },
    ],
  },
  {
    title: "Family history",
    questions: [
      { id: "family-conditions", label: "Conditions in the family", options: CONDITIONS },
      {
        id: "family-history",
        label: "Who had what",
        hint: "Mother, father, siblings, grandparents, aunts and uncles: illnesses, ages, causes and ages of death. Note maternal or paternal side.",
        long: true,
      },
      { id: "family-similar", label: "Relatives with complaints like theirs" },
      { id: "family-trauma", label: "Trauma or major stress in the family" },
    ],
  },
  {
    title: "Birth and childhood",
    questions: [
      { id: "prenatal", label: "Their mother's pregnancy", hint: "Her health, emotions, shocks, medications or drugs." },
      { id: "birth", label: "Their birth", hint: "Difficulties, forceps, cord, premature, jaundice." },
      { id: "development", label: "Development", hint: "Teething, walking, talking, toilet training, bedwetting; ate chalk or dirt?" },
      { id: "childhood-illnesses", label: "Childhood illnesses", hint: "Severe or repeated ones, ear infections, tonsils, antibiotics." },
      { id: "childhood", label: "What they were like as a child", hint: "Personality, fears, school, family life, anything difficult.", long: true },
    ],
  },
  GENERALS,
  FOOD,
  SLEEP,
  SWEAT,
  HEAD_TO_TOE,
  {
    title: "Women",
    questions: [
      { id: "menarche", label: "Age at first period; at menopause" },
      { id: "cycle", label: "Cycle", hint: "How often, how long, flow, colour, clots, smell, time of day heaviest, pain." },
      { id: "menses-mood", label: "Before, during and after the period", hint: "PMS, mood, breasts, headaches; better or worse once the flow starts." },
      { id: "pregnancies", label: "Pregnancies, births, miscarriages, abortions", hint: "Complications, emotions, how they were after each birth." },
      { id: "contraception", label: "Contraception and hormone history" },
      { id: "menopause", label: "Perimenopause or menopause symptoms" },
      { id: "female-other", label: "Discharges, cysts, fibroids, breasts, recurrent cystitis" },
    ],
  },
  {
    title: "Men",
    folded: true,
    questions: [{ id: "men", label: "Prostate, erections, testes, other" }],
  },
  MIND,
  {
    title: "Practitioner's observations",
    questions: [
      { id: "observed", label: "What you notice", options: OBSERVED },
      { id: "observations", label: "Appearance, manner, speech, gestures, what stood out", long: true },
    ],
  },
  SENSATION,
  {
    title: "Anything else",
    questions: [
      { id: "timeline", label: "Life timeline", hint: "Year by year: illnesses, traumas, losses, moves, and how they reacted.", long: true },
      { id: "misc", label: "Anything else they want to discuss" },
    ],
  },
  CLOSE,
];

const CHILD: Section[] = [
  {
    title: "About the child",
    questions: [
      { id: "age", label: "Age" },
      { id: "household", label: "Parents and home", hint: "Parents' relationship, any discord or tension that affects the child." },
      { id: "siblings", label: "Siblings", hint: "Ages and how they get along." },
      { id: "school-care", label: "School or childcare" },
    ],
  },
  { title: "Main complaint", questions: complaint(1, "Main issues the parents want addressed") },
  { title: "Second complaint", questions: complaint(2, "Second complaint"), folded: true },
  {
    title: "Pregnancy and birth",
    questions: [
      { id: "pregnancy-physical", label: "Mother's strong physical symptoms, cravings and aversions in pregnancy" },
      { id: "pregnancy-exposures", label: "Toxins, medications, shock, trauma or grief in pregnancy" },
      { id: "pregnancy-emotions", label: "Mother's emotional state in pregnancy", hint: "Stress at work or home, major fears, planned or not." },
      { id: "delivery", label: "The delivery", hint: "Type, length, traumas to mother or baby, medications, how supported the mother felt." },
      { id: "newborn", label: "As a newborn", hint: "Jaundice, feeding, breast or bottle, weight gain, sleep." },
    ],
  },
  {
    title: "Early childhood",
    questions: [
      { id: "infancy", label: "As a baby", hint: "Colic, GI symptoms, reflux, infections, other medical issues." },
      { id: "first-two-years", label: "Illnesses in the first 24 months", hint: "Colds, flus, hand foot and mouth, roseola, strep, ear infections, diarrhoea, constipation." },
      { id: "baby-personality", label: "The baby's personality", hint: "High needs, easy going, always wanted carrying, hated the car?" },
      { id: "development", label: "Developmental milestones", hint: "Teething, sitting, walking, talking, toilet training. Any delay, or a point after which regression was noticed." },
    ],
  },
  {
    title: "Medical history",
    questions: [
      { id: "past-illnesses", label: "Past illnesses", options: PAST_ILLNESSES },
      { id: "recurring", label: "Recurring conditions", hint: "Coughs, chest infections, tonsillitis, ear infections, stomach complaints." },
      { id: "medications", label: "Current supplements and medications" },
      { id: "long-term-meds", label: "Tylenol, antibiotics or other medicines in the past", hint: "When and for how long; cortisone creams for skin." },
      { id: "childhood-diseases", label: "Childhood diseases with severe symptoms", hint: "Measles, chicken pox, croup, mumps, whooping cough…" },
      { id: "vaccinations", label: "Vaccinations, ages, and any reactions", hint: "Swelling, fever, clingy, runny nose, anything more severe." },
      { id: "injuries", label: "Accidents, falls, head injuries" },
      { id: "allergies", label: "Food or environmental allergies" },
      { id: "other-therapies", label: "Other therapies now" },
      { id: "labs", label: "Lab results", hint: "Stool or OAT tests, blood counts, titers, heavy metals." },
    ],
  },
  {
    title: "Family history",
    questions: [
      { id: "family-conditions", label: "Conditions in parents and the wider family", options: CONDITIONS },
      { id: "family-history", label: "Who had what", hint: "Note maternal or paternal side.", long: true },
      { id: "family-stress", label: "Strong stresses since the child was born", hint: "Moves, losses, deaths, stressful jobs." },
    ],
  },
  GENERALS,
  FOOD,
  SLEEP,
  SWEAT,
  {
    ...HEAD_TO_TOE,
    questions: [
      ...HEAD_TO_TOE.questions.filter((q) => !["heart", "neck-glands"].includes(q.id)),
      { id: "neuro", label: "Tics, twitches, stimming or seizures" },
    ],
  },
  {
    title: "Behaviour and emotions",
    questions: [
      { id: "mood", label: "General mood; tantrums", hint: "Stable or volatile? How tantrums begin, progress and end." },
      { id: "stress", label: "What is most stressful for the child, and how they react" },
      { id: "fears", label: "Fears", hint: "In the box: worries in the parents' words.", options: FEARS },
      { id: "when-ill", label: "When ill or upset", options: CONSOLATION },
      { id: "traits", label: "Traits", options: TRAITS },
      { id: "personality", label: "Personality and patterns of behaviour" },
      { id: "unusual", label: "Strange or unusual behaviours, obsessions" },
      { id: "school", label: "Learning, and what teachers or carers say" },
      { id: "pets-music", label: "Pets, music and dancing" },
      { id: "enjoy", label: "What they love most; where they are most in their element" },
    ],
  },
  {
    title: "Practitioner's observations",
    questions: [
      { id: "observed", label: "What you notice", options: OBSERVED },
      { id: "observations", label: "How the child behaves in the session; how the parents and child are together", long: true },
    ],
  },
  SENSATION,
  {
    title: "Anything else",
    questions: [
      { id: "timeline", label: "Timeline of traumas, illnesses and important events, and how the child reacted", long: true },
      { id: "misc", label: "Anything else the parents want to discuss" },
    ],
  },
  CLOSE,
];

const FOLLOWUP: Section[] = [
  {
    title: "Since the last visit",
    questions: [
      { id: "how-doing", label: "How are they doing?", long: true },
      { id: "took-remedies", label: "Did they take the remedies, and what did they notice?" },
      { id: "old-symptoms", label: "Any return of old symptoms?" },
      { id: "new-symptoms", label: "Any new symptoms?" },
      { id: "energy", label: "Energy, sleep and mood" },
      { id: "stool", label: "Bowel movements", hint: "Any new constipation? Address it to prevent aggravations." },
      { id: "intake-review", label: "Changes in their original intake complaints", hint: "Useful if they noticed nothing." },
    ],
  },
  SENSATION,
  CLOSE,
];

const ACUTE: Section[] = [
  { title: "The complaint", questions: complaint(1, "What is wrong") },
  {
    title: "In themselves",
    questions: [
      { id: "mind-acute", label: "Mood and behaviour while ill", options: ["Irritable", "Clingy", "Wants to be alone", "Restless", "Fearful", "Weepy", "Dull, sleepy", "Delirious", "Wants to be carried"] },
      { id: "thermal", label: "Hot or chilly", options: ["Chilly", "Hot", "Hot head, cold limbs", "Sweaty", "Dry heat"] },
      { id: "thirst", label: "Thirst", options: THIRST },
      { id: "generals-acute", label: "Appetite, sleep, discharges" },
    ],
  },
  { title: "Remedies and plan", questions: [CLOSE.questions[1], CLOSE.questions[2]] },
];

export const FORMS: Record<VisitKind, Section[]> = { adult: ADULT, child: CHILD, followup: FOLLOWUP, acute: ACUTE };

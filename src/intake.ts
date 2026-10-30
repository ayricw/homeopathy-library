import type { VisitKind } from "../shared/clients";

// The forms for each kind of visit. The order follows the School of Intuitive Homeopathy's case taking
// summary: intake form first, main complaint, modalities, family history, a review of the body's systems,
// then the sensation process. The questions are kept here, not stored: a visit saves only the answers,
// by question id, so a question's wording can change without touching saved visits.
// Ids must never be reused for a different question.

export interface Question {
  id: string;
  label: string;
  /** Prompts shown under the question. */
  hint?: string;
}

export interface Section {
  title: string;
  questions: Question[];
}

export const KIND_LABEL: Record<VisitKind, string> = {
  adult: "Full intake (adult)",
  child: "Full intake (child)",
  followup: "Follow-up",
  acute: "Acute",
};

const MAIN_COMPLAINT: Section = {
  title: "Main complaint",
  questions: [
    { id: "main-complaint", label: "Main complaint in their own words", hint: "Include a timeline of notable symptoms and events." },
    { id: "onset", label: "When did it begin, and what was happening in their life then?", hint: "What do they think caused it?" },
    { id: "location-sensation", label: "Location, sensation and extension", hint: "Where exactly; what it feels like (burning, stitching, pressing…); does it spread?" },
    { id: "pain", label: "Recurrent pain", hint: "Location, quality, what makes it worse and what relieves it." },
    {
      id: "modalities",
      label: "Better and worse",
      hint: "Time of day or night (an hour if they can), time of year, weather, heat or cold, seashore, motion or rest, position, food, light, noise, company, new situations.",
    },
    { id: "concomitants", label: "What else happens alongside it" },
  ],
};

const SENSATION: Section = {
  title: "Sensation process",
  questions: [
    {
      id: "sensation",
      label: "Sensation process",
      hint: "Eyes closed, breathing, connected to the body: how do you feel in your body? Tell me more. Note their exact, unusual and repeated words, and how times of trauma felt.",
    },
  ],
};

const CLOSE: Section = {
  title: "Remedies and plan",
  questions: [
    { id: "remedy-ideas", label: "Remedies that came to mind during the case" },
    { id: "plan", label: "Dosing plan and instructions sent", hint: "And when to follow up (usually 3 to 6 weeks)." },
  ],
};

const ADULT: Section[] = [
  {
    title: "About them",
    questions: [
      { id: "occupation", label: "Occupation" },
      { id: "household", label: "Home and family", hint: "Who they live with, relationships." },
    ],
  },
  MAIN_COMPLAINT,
  {
    title: "Medical history",
    questions: [
      { id: "history", label: "Important medical history", hint: "Symptoms, conditions, significant traumas or events." },
      { id: "medications", label: "Current supplements and medications" },
      { id: "long-term-meds", label: "Medications taken over a longer term", hint: "Steroids, birth control, antibiotics…" },
      { id: "vaccinations", label: "Vaccinations and any reactions" },
      { id: "substances", label: "Alcohol, drugs, recreational use, addiction" },
      { id: "labs", label: "Lab tests and other medical findings" },
      { id: "other-therapies", label: "Other practitioners and therapies" },
    ],
  },
  {
    title: "Family history",
    questions: [
      {
        id: "family-history",
        label: "Illness in parents, grandparents and siblings",
        hint: "Diabetes, thyroid, heart disease, cancer (type), asthma, allergies, epilepsy, tuberculosis, repeated strep, herpes, Lyme, chronic fatigue, mold illness, liver disease, alcohol or drug abuse, depression, anxiety, bipolar, schizophrenia. Note maternal or paternal side.",
      },
      { id: "family-trauma", label: "Trauma or major stress in the family" },
    ],
  },
  {
    title: "Body systems and generals",
    questions: [
      { id: "acutes", label: "How often they get sick", hint: "Fevers, colds, flu. Describe a typical acute illness." },
      { id: "energy", label: "Energy through the day" },
      { id: "sleep", label: "Sleep", hint: "Falling and staying asleep, position, hot or restless in sleep, dreams." },
      { id: "digestion", label: "Appetite and digestion", hint: "Nausea, vomiting, acid, gas, bloating." },
      { id: "stool", label: "Stool", hint: "How often, consistency, colour, diarrhoea or constipation." },
      { id: "food", label: "Food cravings and aversions; thirst" },
      { id: "thermal", label: "Hot or chilly; sweat" },
      { id: "allergies", label: "Food or environmental allergies", hint: "What their allergy symptoms are like." },
      { id: "skin", label: "Skin, hair and nails" },
      { id: "head-to-toe", label: "Anything else, head to toe", hint: "Head, eyes, ears, nose, throat, chest, heart, urinary, joints, nerves." },
    ],
  },
  {
    title: "Women",
    questions: [
      { id: "cycle", label: "Cycle", hint: "Age at first period, length, flow, pain, mood before and during; menopause." },
      { id: "pregnancies", label: "Pregnancies", hint: "Complications or stress during them." },
    ],
  },
  {
    title: "Mind and emotions",
    questions: [
      { id: "stress", label: "What stresses them most, and how they react or cope" },
      { id: "fears", label: "Fears and worries" },
      { id: "emotions", label: "Grief, anger, sadness, anxiety", hint: "How they respond to consolation; company or alone." },
      { id: "enjoy", label: "What they most enjoy; where they are most in their element" },
      { id: "personality", label: "How they would describe themselves; how others describe them" },
    ],
  },
  SENSATION,
  {
    title: "Anything else",
    questions: [{ id: "misc", label: "Anything else they want to discuss" }],
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
    ],
  },
  {
    ...MAIN_COMPLAINT,
    questions: [
      { id: "main-complaint", label: "Main issues the parents want addressed" },
      { id: "onset", label: "When did these begin, and what was happening in the child's life then?", hint: "What do the parents think caused them?" },
      MAIN_COMPLAINT.questions[4],
      { id: "pain", label: "Pain", hint: "Headaches, stomach aches, other. Sensitive to pain? If you imagine you are them, what does it feel like?" },
      MAIN_COMPLAINT.questions[5],
    ],
  },
  {
    title: "Pregnancy and birth",
    questions: [
      { id: "pregnancy-physical", label: "Mother's strong physical symptoms, cravings and aversions in pregnancy" },
      { id: "pregnancy-exposures", label: "Toxins, medications, shock, trauma or grief in pregnancy" },
      { id: "pregnancy-emotions", label: "Mother's emotional state in pregnancy", hint: "Stress at work or home, major fears, planned or not." },
      { id: "delivery", label: "The delivery", hint: "Type, traumas to mother or baby, medications, how supported the mother felt." },
    ],
  },
  {
    title: "Early childhood",
    questions: [
      { id: "infancy", label: "As a baby", hint: "Colic, GI symptoms, reflux, infections, other medical issues." },
      { id: "first-two-years", label: "Illnesses in the first 24 months", hint: "Colds, flus, hand foot and mouth, roseola, strep, ear infections, diarrhoea, constipation." },
      { id: "baby-personality", label: "The baby's personality", hint: "High needs, easy going, always wanted carrying, hated the car?" },
      { id: "development", label: "Developmental milestones", hint: "Any delay, or a point after which regression was noticed." },
    ],
  },
  {
    title: "Medical history",
    questions: [
      { id: "recurring", label: "Recurring conditions", hint: "Coughs, chest infections, tonsillitis, ear infections, stomach complaints." },
      { id: "medications", label: "Current supplements and medications" },
      { id: "long-term-meds", label: "Tylenol, antibiotics or other medicines in the past", hint: "When and for how long; cortisone creams for skin." },
      { id: "childhood-diseases", label: "Childhood diseases with severe symptoms", hint: "Measles, chicken pox, croup, mumps, whooping cough…" },
      { id: "vaccinations", label: "Vaccinations, ages, and any reactions" },
      { id: "other-therapies", label: "Other therapies now" },
      { id: "labs", label: "Lab results", hint: "Stool or OAT tests, blood counts, titers, heavy metals." },
    ],
  },
  {
    title: "Family history",
    questions: [
      {
        id: "family-history",
        label: "Illness in parents and the wider family",
        hint: "Diabetes, obesity, thyroid, heart disease, cancer (type), asthma, allergies, epilepsy, tuberculosis, repeated strep, herpes, Lyme, chronic fatigue, mold illness, liver disease, alcohol or drug abuse, depression, anxiety, bipolar, schizophrenia. Note maternal or paternal side.",
      },
      { id: "family-stress", label: "Strong stresses since the child was born", hint: "Moves, losses, deaths, stressful jobs." },
    ],
  },
  {
    title: "Behaviour and emotions",
    questions: [
      { id: "mood", label: "General mood; tantrums", hint: "Stable or volatile? How tantrums begin, progress and end." },
      { id: "stress", label: "What is most stressful for the child, and how they react" },
      { id: "enjoy", label: "What they love most; where they are most in their element" },
      { id: "personality", label: "Personality and patterns of behaviour" },
      { id: "when-ill", label: "When ill or upset", hint: "Clingy, wants to be left alone, irritable, restless? More or less affectionate?" },
      { id: "unusual", label: "Strange or unusual behaviours, obsessions, stimming" },
      { id: "traits", label: "Competitive, sympathetic, stubborn, perfectionist, sensitive to reprimand?" },
      { id: "fears", label: "Fears and worries" },
      { id: "school", label: "Learning, and what teachers or carers say" },
      { id: "pets-music", label: "Pets, music and dancing" },
    ],
  },
  {
    title: "Body and generals",
    questions: [
      { id: "acutes", label: "Illnesses in the past year", hint: "Describe a typical one." },
      { id: "neuro", label: "Tics, twitches or seizures" },
      { id: "sleep", label: "Sleep", hint: "Falling and staying asleep, restless or hot in sleep." },
      { id: "skin", label: "Skin, hair and nails", hint: "Rashes, eczema, infections." },
      { id: "allergies", label: "Food or environmental allergies" },
      { id: "diet", label: "Diet; foods they prefer", hint: "Has a change of diet made a difference?" },
      { id: "generals", label: "Thirsty or thirstless; hungry or rarely hungry; hot; sweaty in sleep" },
      { id: "stool", label: "Stool", hint: "How often, consistency, colour, diarrhoea or constipation." },
      { id: "digestion", label: "Nausea, vomiting, acid, gas or bloating" },
      { id: "urine", label: "Urination; bedwetting or waking to pee" },
    ],
  },
  SENSATION,
  {
    title: "Anything else",
    questions: [
      { id: "misc", label: "Anything else the parents want to discuss" },
      { id: "timeline", label: "Timeline of traumas, illnesses and important events, and how the child reacted" },
    ],
  },
  CLOSE,
];

const FOLLOWUP: Section[] = [
  {
    title: "Since the last visit",
    questions: [
      { id: "how-doing", label: "How are they doing?" },
      { id: "took-remedies", label: "Did they take the remedies, and what did they notice?" },
      { id: "old-symptoms", label: "Any return of old symptoms?" },
      { id: "new-symptoms", label: "Any new symptoms?" },
      { id: "stool", label: "Bowel movements", hint: "Any new constipation? Address it to prevent aggravations." },
      { id: "intake-review", label: "Changes in their original intake complaints", hint: "Useful if they noticed nothing." },
    ],
  },
  SENSATION,
  CLOSE,
];

const ACUTE: Section[] = [
  MAIN_COMPLAINT,
  {
    title: "In themselves",
    questions: [
      { id: "mind-acute", label: "Mood and behaviour while ill", hint: "Irritable, clingy, wants to be alone, restless, fearful?" },
      { id: "generals-acute", label: "Thirst, heat or chill, sweat, appetite, sleep" },
    ],
  },
  { title: "Remedies and plan", questions: [{ id: "remedy-ideas", label: "Remedies that came to mind" }, CLOSE.questions[1]] },
];

export const FORMS: Record<VisitKind, Section[]> = { adult: ADULT, child: CHILD, followup: FOLLOWUP, acute: ACUTE };

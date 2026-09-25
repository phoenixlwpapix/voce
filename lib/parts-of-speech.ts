export const partOfSpeechCodes = [
  "noun", "proper_noun", "verb", "pronominal_verb", "auxiliary_verb",
  "adjective", "adjectival_noun", "adverb", "pronoun", "determiner",
  "article", "preposition", "conjunction", "interjection", "numeral",
  "particle", "phrase",
] as const;

export type PartOfSpeechCode = (typeof partOfSpeechCodes)[number];
export type LexiconLanguage = "EN" | "FR" | "ES" | "JA";

const labels: Record<LexiconLanguage, Record<PartOfSpeechCode, string>> = {
  EN: {
    noun: "noun", proper_noun: "proper noun", verb: "verb", pronominal_verb: "pronominal verb",
    auxiliary_verb: "auxiliary verb", adjective: "adjective", adjectival_noun: "adjectival noun",
    adverb: "adverb", pronoun: "pronoun", determiner: "determiner", article: "article",
    preposition: "preposition", conjunction: "conjunction", interjection: "interjection",
    numeral: "numeral", particle: "particle", phrase: "phrase",
  },
  FR: {
    noun: "nom", proper_noun: "nom propre", verb: "verbe", pronominal_verb: "verbe pronominal",
    auxiliary_verb: "verbe auxiliaire", adjective: "adjectif", adjectival_noun: "nom adjectival",
    adverb: "adverbe", pronoun: "pronom", determiner: "déterminant", article: "article",
    preposition: "préposition", conjunction: "conjonction", interjection: "interjection",
    numeral: "numéral", particle: "particule", phrase: "expression",
  },
  ES: {
    noun: "sustantivo", proper_noun: "nombre propio", verb: "verbo", pronominal_verb: "verbo pronominal",
    auxiliary_verb: "verbo auxiliar", adjective: "adjetivo", adjectival_noun: "sustantivo adjetival",
    adverb: "adverbio", pronoun: "pronombre", determiner: "determinante", article: "artículo",
    preposition: "preposición", conjunction: "conjunción", interjection: "interjección",
    numeral: "numeral", particle: "partícula", phrase: "expresión",
  },
  JA: {
    noun: "名詞", proper_noun: "固有名詞", verb: "動詞", pronominal_verb: "動詞",
    auxiliary_verb: "助動詞", adjective: "形容詞", adjectival_noun: "形容動詞",
    adverb: "副詞", pronoun: "代名詞", determiner: "連体詞", article: "冠詞",
    preposition: "前置詞", conjunction: "接続詞", interjection: "感動詞",
    numeral: "数詞", particle: "助詞", phrase: "表現",
  },
};

export function partOfSpeechLabel(language: LexiconLanguage, code: PartOfSpeechCode): string {
  return labels[language][code];
}

export function isPronominalVerb(language: LexiconLanguage, forms: (string | undefined)[]): boolean {
  if (language === "ES") return forms.some((form) => form !== undefined && /(?:ar|er|ir)se$/iu.test(form.trim()));
  if (language === "FR") return forms.some((form) => form !== undefined && /^(?:se\s+|s['’])[\p{L}]/iu.test(form.trim()));
  return false;
}

const genderLabels = {
  EN: { title: "Gender", masculine: "Masculine", feminine: "Feminine", neutral: "Neutral" },
  FR: { title: "Genre", masculine: "masculin", feminine: "féminin", neutral: "neutre" },
  ES: { title: "Género", masculine: "masculino", feminine: "femenino", neutral: "neutro" },
  JA: { title: "性", masculine: "男性", feminine: "女性", neutral: "中性" },
} as const;

export function genderLabel(language: LexiconLanguage, gender: "masculine" | "feminine" | "neutral"): string {
  const labels = genderLabels[language];
  return `${labels.title} · ${labels[gender]}`;
}

type LegacyPartOfSpeech = { code: PartOfSpeechCode; gender?: "masculine" | "feminine" };

// Labels written by earlier prompt versions: abbreviations, gendered noun
// labels, Chinese grammar terms, and the current labels of every language.
const legacyLabels = new Map<string, LegacyPartOfSpeech>([
  ...partOfSpeechCodes.map((code) => [code.replace("_", " "), { code }] as const),
  ...Object.values(labels).flatMap((table) =>
    (Object.entries(table) as [PartOfSpeechCode, string][])
      // Japanese labels pronominal verbs as plain 動詞; keep that label unambiguous.
      .filter(([code, label]) => code !== "pronominal_verb" || label !== table.verb)
      .map(([code, label]) => [label.toLowerCase(), { code }] as const)),
  ...([
    ["n", "noun"], ["v", "verb"], ["vt", "verb"], ["vi", "verb"], ["adj", "adjective"], ["adv", "adverb"],
    ["prep", "preposition"], ["conj", "conjunction"], ["pron", "pronoun"], ["interj", "interjection"],
    ["int", "interjection"], ["art", "article"], ["num", "numeral"], ["det", "determiner"], ["aux", "auxiliary_verb"],
    ["phr", "phrase"], ["expr", "phrase"], ["loc", "phrase"], ["locution", "phrase"], ["idiom", "phrase"],
    ["v pr", "pronominal_verb"], ["vpr", "pronominal_verb"], ["v prnl", "pronominal_verb"], ["reflexive verb", "pronominal_verb"],
    ["transitive verb", "verb"], ["intransitive verb", "verb"], ["phrasal verb", "verb"],
    // Japanese dictionary abbreviations.
    ["名", "noun"], ["動", "verb"], ["形", "adjective"], ["形動", "adjectival_noun"], ["副", "adverb"],
    ["名词", "noun"], ["专有名词", "proper_noun"], ["形容词", "adjective"], ["形容动词", "adjectival_noun"],
    ["副词", "adverb"], ["代词", "pronoun"], ["介词", "preposition"], ["连词", "conjunction"], ["感叹词", "interjection"],
    ["叹词", "interjection"], ["数词", "numeral"], ["冠词", "article"], ["助词", "particle"], ["短语", "phrase"],
    ["词组", "phrase"], ["限定词", "determiner"], ["助动词", "auxiliary_verb"], ["连体词", "determiner"],
  ] as const).map(([label, code]) => [label, { code }] as const),
  ...([
    ["m", "masculine"], ["f", "feminine"], ["nm", "masculine"], ["nf", "feminine"], ["n m", "masculine"], ["n f", "feminine"],
    ["sm", "masculine"], ["sf", "feminine"], ["s m", "masculine"], ["s f", "feminine"],
    ["nom masculin", "masculine"], ["nom féminin", "feminine"], ["sustantivo masculino", "masculine"],
    ["sustantivo femenino", "feminine"], ["masculine noun", "masculine"], ["feminine noun", "feminine"],
  ] as const).map(([label, gender]) => [label, { code: "noun", gender }] as const),
]);

export function legacyPartOfSpeech(label: string): LegacyPartOfSpeech | null {
  // A combined label such as "adjective / adverb" keeps its first category.
  const parts = label.split(/\s*[/,;、，]\s*/u).filter(Boolean);
  if (parts.length > 1) return legacyPartOfSpeech(parts[0]);
  const key = label.normalize("NFC").trim().toLowerCase().replace(/[.·]/g, " ").replace(/\s+/g, " ").trim();
  const known = legacyLabels.get(key);
  if (known) return known;
  // Chinese and Japanese verb subclasses such as 自动词五段 or 他動詞.
  if (/助[动動]词|助動詞/u.test(key)) return { code: "auxiliary_verb" };
  if (/形容[动動]/u.test(key)) return { code: "adjectival_noun" };
  if (/[动動][词詞]/u.test(key)) return { code: "verb" };
  if (/形容[词詞]/u.test(key)) return { code: "adjective" };
  if (/名[词詞]/u.test(key)) return { code: "noun" };
  return null;
}

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

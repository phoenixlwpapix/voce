"use node";

import { GoogleGenAI } from "@google/genai";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { normalizeWord, sanitizeInput, type Language } from "./normalization";

const maxWordLength = 80;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const hiraganaReadingPattern = /^[\p{Script=Hiragana}ー・\s]+$/u;
const nonBlank = z.string().trim().min(1).max(500);

const vocabularyLookupSchema = z.object({
  word: z.string().trim().min(1).max(maxWordLength),
  phonetic: z.string().trim().min(1).max(160),
  definitions: z
    .array(
      z.object({
        partOfSpeech: z.string().trim().min(1).max(80),
        meaningZh: z.string().trim().min(1).max(240),
      }),
    )
    .min(1)
    .max(8),
  grammar: z
    .object({
      gender: z.enum(["masculine", "feminine", "neutral"]).optional(),
      infinitive: z.string().trim().min(1).max(100).optional(),
      noteZh: z.string().trim().min(1).max(240).optional(),
    })
    .optional(),
  examples: z.tuple([
    z.object({ target: nonBlank, translationZh: nonBlank }),
    z.object({ target: nonBlank, translationZh: nonBlank }),
  ]),
});

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    word: { type: "string", description: "Canonical display form of the requested word." },
    phonetic: {
      type: "string",
      description: "Hiragana reading only for Japanese; otherwise IPA only without slashes or explanatory prose.",
    },
    definitions: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          partOfSpeech: { type: "string" },
          meaningZh: { type: "string" },
        },
        required: ["partOfSpeech", "meaningZh"],
      },
    },
    grammar: {
      type: "object",
      additionalProperties: false,
      properties: {
        gender: { type: "string", enum: ["masculine", "feminine", "neutral"] },
        infinitive: { type: "string" },
        noteZh: { type: "string" },
      },
    },
    examples: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          target: { type: "string" },
          translationZh: { type: "string" },
        },
        required: ["target", "translationZh"],
      },
    },
  },
  required: ["word", "phonetic", "definitions", "examples"],
} as const;

const languageInstruction: Record<Language, string> = {
  EN: "English",
  FR: "French",
  ES: "Spanish",
  JA: "Japanese",
};

const baseLexicographerInstruction =
  "You are a precise multilingual lexicographer for Chinese learners. Return the canonical word, concise Simplified Chinese definitions with part of speech, and exactly two natural bilingual examples. In the phonetic field, return Hiragana only for Japanese vocabulary; for every other language return IPA only. Never add slashes, brackets, pitch-accent numbers, or explanatory prose to the phonetic field. For relevant French or Spanish nouns include gender. For conjugated French or Spanish verbs, or inflected Japanese verbs and adjectives, put the infinitive or Japanese dictionary form in the infinitive field. For Japanese vocabulary, use the grammar note for a concise usage note when helpful. Omit irrelevant grammar fields. Before returning, check that every example is grammatically correct and that its subject, finite verbs, pronouns, and possessives agree. Never use Markdown.";

const languageSpecificInstruction: Record<Language, string> = {
  EN: "Write idiomatic English examples with consistent person, number, and tense.",
  FR: "For French pronominal verbs, never copy the dictionary-form pronoun se into an example mechanically. Inflect the reflexive pronoun to agree with the example's subject: me/m', te/t', se/s', nous, vous, or se/s'. This agreement must also hold when the pronominal infinitive follows a conjugated modal or another verb: write \"Tu dois te brosser les dents\", never \"Tu dois se brosser les dents\". Check the subject, conjugated verb, and reflexive pronoun together before returning each example.",
  ES: "For Spanish pronominal or reflexive verbs ending in -se, never copy the dictionary-form clitic se into an example mechanically. Inflect the clitic to agree with the example's subject: me, te, se, nos, os, or se. When a pronominal infinitive follows a conjugated modal or another verb, either attach the agreeing clitic to the infinitive or place it before the conjugated verb: write \"Debes cepillarte los dientes\" or \"Te debes cepillar los dientes\", never \"Debes cepillarse los dientes\". Check the subject, conjugated verb, and reflexive clitic together before returning each example.",
  JA: "Write natural Japanese examples with internally consistent politeness, particles, and inflection.",
};

export type LookupActionResult = {
  id: Id<"words">;
  status: "created" | "existing";
  word: string;
};

type LookupForOwnerArgs = {
  ownerId: Id<"users">;
  inputWord: string;
  language: Language;
  monthGroup: string;
};

function safeGenerationError(error: unknown): never {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("429") || message.includes("rate") || message.includes("quota")) {
    throw new ConvexError("The lookup service is busy. Try again shortly.");
  }
  if (message.includes("timeout") || message.includes("deadline") || message.includes("abort")) {
    throw new ConvexError("The lookup timed out. Check your connection and try again.");
  }
  throw new ConvexError("The lookup couldn't be completed. Try again shortly.");
}

export async function lookupAndSaveForOwner(
  ctx: ActionCtx,
  args: LookupForOwnerArgs,
): Promise<LookupActionResult> {
  const inputWord = sanitizeInput(args.inputWord);
  if (!inputWord) {
    throw new ConvexError("Enter a word to look up.");
  }
  if (inputWord.length > maxWordLength) {
    throw new ConvexError(`Words can't exceed ${maxWordLength} characters.`);
  }
  if (!monthPattern.test(args.monthGroup)) {
    throw new ConvexError("Invalid month format. Refresh the page and try again.");
  }

  const normalizedWord = normalizeWord(inputWord, args.language);
  const existing: { id: Id<"words">; word: string } | null = await ctx.runQuery(
    internal.internalWords.findExistingWord,
    {
      ownerId: args.ownerId,
      language: args.language,
      normalizedWord,
    },
  );
  if (existing !== null) {
    return { ...existing, status: "existing" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ConvexError("The lookup service isn't configured. Contact the maintainer.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: `Look up the ${languageInstruction[args.language]} vocabulary item: ${JSON.stringify(inputWord)}.`,
      config: {
        systemInstruction: `${baseLexicographerInstruction} ${languageSpecificInstruction[args.language]}`,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema,
        httpOptions: { timeout: 20_000 },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty structured response");
    }

    const parsedJson: unknown = JSON.parse(responseText);
    const result = vocabularyLookupSchema.parse(parsedJson);
    if (args.language === "JA" && !hiraganaReadingPattern.test(result.phonetic)) {
      throw new Error("Japanese pronunciation was not returned in Hiragana");
    }
    return await ctx.runMutation(internal.internalWords.upsertLookupResult, {
      ownerId: args.ownerId,
      inputWord,
      normalizedWord,
      language: args.language,
      monthGroup: args.monthGroup,
      result,
    });
  } catch (error) {
    safeGenerationError(error);
  }
}

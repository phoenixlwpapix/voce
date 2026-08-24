"use node";

import { GoogleGenAI } from "@google/genai";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { normalizeWord, sanitizeInput } from "./normalization";
import { languageValidator } from "./validators";

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

const languageInstruction = {
  EN: "English",
  FR: "French",
  ES: "Spanish",
  JA: "Japanese",
} as const;

type LookupActionResult = {
  id: Id<"words">;
  status: "created" | "refreshed";
  word: string;
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

export const lookupAndSave = action({
  args: {
    inputWord: v.string(),
    language: languageValidator,
    monthGroup: v.string(),
  },
  returns: v.object({
    id: v.id("words"),
    status: v.union(v.literal("created"), v.literal("refreshed")),
    word: v.string(),
  }),
  handler: async (ctx, args): Promise<LookupActionResult> => {
    const ownerId = (await getAuthUserId(ctx)) as Id<"users"> | null;
    if (ownerId === null) {
      throw new ConvexError("Please sign in to continue.");
    }
    await ctx.runQuery(internal.account.assertOwner, { userId: ownerId });

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
          systemInstruction:
            "You are a precise multilingual lexicographer for Chinese learners. Return the canonical word, concise Simplified Chinese definitions with part of speech, and exactly two natural bilingual examples. In the phonetic field, return Hiragana only for Japanese vocabulary; for every other language return IPA only. Never add slashes, brackets, pitch-accent numbers, or explanatory prose to the phonetic field. For relevant French or Spanish nouns include gender. For conjugated French or Spanish verbs, or inflected Japanese verbs and adjectives, put the infinitive or Japanese dictionary form in the infinitive field. For Japanese vocabulary, use the grammar note for a concise usage note when helpful. Omit irrelevant grammar fields. Never use Markdown.",
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
        ownerId,
        inputWord,
        normalizedWord: normalizeWord(inputWord, args.language),
        language: args.language,
        monthGroup: args.monthGroup,
        result,
      });
    } catch (error) {
      safeGenerationError(error);
    }
  },
});

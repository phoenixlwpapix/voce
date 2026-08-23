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
    phonetic: { type: "string", description: "IPA only, without slashes or explanatory prose." },
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
} as const;

type LookupActionResult = {
  id: Id<"words">;
  status: "created" | "refreshed";
  word: string;
};

function safeGenerationError(error: unknown): never {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("429") || message.includes("rate") || message.includes("quota")) {
    throw new ConvexError("查询服务正忙，请稍后再试。");
  }
  if (message.includes("timeout") || message.includes("deadline") || message.includes("abort")) {
    throw new ConvexError("查询超时，请检查网络后重试。");
  }
  throw new ConvexError("暂时无法完成查询，请稍后再试。");
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
      throw new ConvexError("请先登录后再继续。");
    }
    await ctx.runQuery(internal.account.assertOwner, { userId: ownerId });

    const inputWord = sanitizeInput(args.inputWord);
    if (!inputWord) {
      throw new ConvexError("请输入要查询的单词。");
    }
    if (inputWord.length > maxWordLength) {
      throw new ConvexError(`单词不能超过 ${maxWordLength} 个字符。`);
    }
    if (!monthPattern.test(args.monthGroup)) {
      throw new ConvexError("月份格式无效，请刷新页面后重试。");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ConvexError("词典服务尚未配置，请联系维护者。");
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: `Look up the ${languageInstruction[args.language]} vocabulary item: ${JSON.stringify(inputWord)}.`,
        config: {
          systemInstruction:
            "You are a precise multilingual lexicographer for Chinese learners. Return the canonical word, IPA only, concise Simplified Chinese definitions with part of speech, and exactly two natural bilingual examples. For relevant French or Spanish nouns include gender. For conjugated French or Spanish verbs include the infinitive. Omit irrelevant grammar fields. Never use Markdown.",
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

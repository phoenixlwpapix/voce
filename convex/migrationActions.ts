"use node";

import { GoogleGenAI } from "@google/genai";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { conventionalPhonetic } from "./lookupCore";
import { normalizeStoredWord } from "./wordFormat";
import { phoneticProblem } from "../lib/phonetics";

const batchSize = 40;

const batchSummaryValidator = v.object({
  scanned: v.number(),
  changed: v.number(),
  phoneticsRegenerated: v.number(),
  phoneticsStillInvalid: v.array(v.string()),
  unknownLabels: v.array(v.string()),
  isDone: v.boolean(),
});

// Brings every saved word to the current house style, one batch per run.
// Each batch schedules the next. With dryRun, nothing is written and no model
// calls are made; the summary shows what would change.
//   npx convex run migrationActions:normalizeExistingWords '{"dryRun": true}'
export const normalizeExistingWords = internalAction({
  args: { cursor: v.optional(v.union(v.string(), v.null())), dryRun: v.optional(v.boolean()) },
  returns: batchSummaryValidator,
  handler: async (ctx, args) => {
    const page: { page: Doc<"words">[]; continueCursor: string; isDone: boolean } = await ctx.runQuery(
      internal.migrations.wordsPage,
      { paginationOpts: { cursor: args.cursor ?? null, numItems: batchSize } },
    );
    const apiKey = process.env.GEMINI_API_KEY;
    const ai = apiKey && !args.dryRun ? new GoogleGenAI({ apiKey }) : null;

    const updates: Array<{
      id: Id<"words">;
      phonetic: string;
      definitions: Doc<"words">["definitions"];
      grammar: NonNullable<Doc<"words">["grammar"]> | null;
    }> = [];
    const phoneticsStillInvalid: string[] = [];
    const unknownLabels = new Set<string>();
    let phoneticsRegenerated = 0;

    for (const word of page.page) {
      const fixed = normalizeStoredWord(word);
      fixed.unknownLabels.forEach((label) => unknownLabels.add(label));
      let phonetic = fixed.phonetic;
      if (phoneticProblem(phonetic, word.language) !== null) {
        if (ai) {
          try {
            phonetic = await conventionalPhonetic(ai, word.language, word.word, phonetic);
            phoneticsRegenerated += 1;
          } catch {
            phoneticsStillInvalid.push(`${word.language} ${word.word} /${phonetic}/`);
          }
        } else {
          phoneticsStillInvalid.push(`${word.language} ${word.word} /${phonetic}/`);
        }
      }

      const next = { phonetic, definitions: fixed.definitions, grammar: fixed.grammar ?? null };
      const current = { phonetic: word.phonetic, definitions: word.definitions, grammar: word.grammar ?? null };
      if (JSON.stringify(next) !== JSON.stringify(current)) updates.push({ id: word._id, ...next });
    }

    if (!args.dryRun && updates.length > 0) {
      await ctx.runMutation(internal.migrations.applyWordFixes, { updates });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrationActions.normalizeExistingWords, {
        cursor: page.continueCursor,
        dryRun: args.dryRun,
      });
    }

    const summary = {
      scanned: page.page.length,
      changed: updates.length,
      phoneticsRegenerated,
      phoneticsStillInvalid,
      unknownLabels: [...unknownLabels],
      isDone: page.isDone,
    };
    console.log(`normalizeExistingWords${args.dryRun ? " (dry run)" : ""}`, JSON.stringify(summary));
    return summary;
  },
});

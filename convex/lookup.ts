"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { lookupAndSaveForOwner } from "./lookupCore";
import { languageValidator, lookupActionResultValidator } from "./validators";

export const lookupAndSave = action({
  args: {
    inputWord: v.string(),
    language: languageValidator,
    monthGroup: v.string(),
    saveInflected: v.optional(v.boolean()),
  },
  returns: lookupActionResultValidator,
  handler: async (ctx, args) => {
    const ownerId = (await getAuthUserId(ctx)) as Id<"users"> | null;
    if (ownerId === null) {
      throw new ConvexError("Please sign in to continue.");
    }
    await ctx.runQuery(internal.account.assertOwner, { userId: ownerId });
    const preferredLanguage = await ctx.runQuery(
      internal.account.getPreferredLanguageForOwner,
      { userId: ownerId },
    );
    if (args.language !== preferredLanguage) {
      throw new ConvexError("Your learning language changed. Refresh and try again.");
    }
    return await lookupAndSaveForOwner(ctx, { ownerId, ...args });
  },
});

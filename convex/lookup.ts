"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { lookupAndSaveForOwner } from "./lookupCore";
import { languageValidator } from "./validators";

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
  handler: async (ctx, args) => {
    const ownerId = (await getAuthUserId(ctx)) as Id<"users"> | null;
    if (ownerId === null) {
      throw new ConvexError("Please sign in to continue.");
    }
    await ctx.runQuery(internal.account.assertOwner, { userId: ownerId });
    return await lookupAndSaveForOwner(ctx, { ownerId, ...args });
  },
});

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOwner } from "./ownership";

const ownerKey = "primary" as const;
const migrationBatchSize = 100;

export const claimOwnership = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
    if (userId === null) {
      throw new ConvexError("请先登录后再继续。");
    }

    const user = await ctx.db.get(userId);
    const accountEmail = user?.email?.trim().toLowerCase();
    const allowedEmail = env.APP_OWNER_EMAIL.trim().toLowerCase();
    if (accountEmail !== allowedEmail) {
      throw new ConvexError("这个账号不在词汇簿的允许名单中。");
    }

    const owner = await ctx.db
      .query("appOwners")
      .withIndex("by_key", (index) => index.eq("key", ownerKey))
      .unique();

    if (owner && owner.userId !== userId) {
      throw new ConvexError("这个词汇簿已绑定其他账号。");
    }

    if (!owner) {
      await ctx.db.insert("appOwners", {
        key: ownerKey,
        userId,
        createdAt: Date.now(),
      });
    }

    await ctx.scheduler.runAfter(0, internal.account.claimLegacyWords, { userId });
    return null;
  },
});

export const currentUser = query({
  args: {},
  returns: v.object({ email: v.union(v.string(), v.null()) }),
  handler: async (ctx) => {
    const userId = await requireOwner(ctx);
    const user = await ctx.db.get(userId);
    return { email: user?.email ?? null };
  },
});

export const assertOwner = internalQuery({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await ctx.db
      .query("appOwners")
      .withIndex("by_key", (index) => index.eq("key", ownerKey))
      .unique();
    if (owner?.userId !== args.userId) {
      throw new ConvexError("这个词汇簿已绑定其他账号。");
    }
    return null;
  },
});

export const claimLegacyWords = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await ctx.db
      .query("appOwners")
      .withIndex("by_key", (index) => index.eq("key", ownerKey))
      .unique();
    if (owner?.userId !== args.userId) {
      return null;
    }

    const words = await ctx.db
      .query("words")
      .withIndex("by_ownerId_createdAt", (index) => index.eq("ownerId", undefined))
      .take(migrationBatchSize);

    for (const word of words) {
      await ctx.db.patch(word._id, { ownerId: args.userId });
    }

    if (words.length === migrationBatchSize) {
      await ctx.scheduler.runAfter(0, internal.account.claimLegacyWords, {
        userId: args.userId,
      });
    }
    return null;
  },
});

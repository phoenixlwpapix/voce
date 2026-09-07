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
      throw new ConvexError("Please sign in to continue.");
    }

    const user = await ctx.db.get(userId);
    const accountEmail = user?.email?.trim().toLowerCase();
    const allowedEmail = env.APP_OWNER_EMAIL.trim().toLowerCase();
    if (accountEmail !== allowedEmail) {
      throw new ConvexError("This account is not on the lexicon's allowlist.");
    }

    const owner = await ctx.db
      .query("appOwners")
      .withIndex("by_key", (index) => index.eq("key", ownerKey))
      .unique();

    if (owner && owner.userId !== userId) {
      throw new ConvexError("This lexicon belongs to another account.");
    }

    if (!owner) {
      await ctx.db.insert("appOwners", {
        key: ownerKey,
        userId,
        createdAt: Date.now(),
      });
    }

    if (!owner) {
      await ctx.scheduler.runAfter(0, internal.account.claimLegacyWords, { userId });
    }
    return null;
  },
});

// The session subject scopes the client subscription across account changes.
// It is compared with the authenticated identity, never trusted as authority.
export const session = query({
  args: { subject: v.string() },
  returns: v.union(
    v.object({ status: v.literal("denied") }),
    v.object({ status: v.literal("setup") }),
    v.object({ status: v.literal("ready"), userId: v.id("users"), email: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = await getAuthUserId(ctx);
    if (!userId || identity?.subject !== args.subject) return { status: "denied" as const };
    const [user, owner] = await Promise.all([
      ctx.db.get(userId),
      ctx.db.query("appOwners").withIndex("by_key", (q) => q.eq("key", ownerKey)).unique(),
    ]);
    if (user?.email?.trim().toLowerCase() !== env.APP_OWNER_EMAIL.trim().toLowerCase()) {
      return { status: "denied" as const };
    }
    if (!owner) return { status: "setup" as const };
    if (owner.userId !== userId) return { status: "denied" as const };
    return { status: "ready" as const, userId, email: user.email ?? null };
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
      throw new ConvexError("This lexicon belongs to another account.");
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

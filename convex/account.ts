import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  env,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireOwner } from "./ownership";
import { languageValidator } from "./validators";
import type { Infer } from "convex/values";

const ownerKey = "primary" as const;
const migrationBatchSize = 100;
type Language = Infer<typeof languageValidator>;

async function assertActiveUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const member = await ctx.db.query("appUsers")
    .withIndex("by_userId", (index) => index.eq("userId", userId)).unique();
  if (member) {
    if (member.status !== "active") throw new ConvexError("This account is suspended.");
    return;
  }
  const owner = await ctx.db.query("appOwners")
    .withIndex("by_userId", (index) => index.eq("userId", userId)).unique();
  if (!owner) throw new ConvexError("This account has not been invited.");
}

async function writePreferredLanguage(
  ctx: MutationCtx,
  userId: Id<"users">,
  language: Language,
) {
  const preferences = await ctx.db
    .query("userPreferences")
    .withIndex("by_userId", (index) => index.eq("userId", userId))
    .unique();
  const updatedAt = Date.now();
  if (preferences) {
    await ctx.db.patch(preferences._id, { preferredLanguage: language, updatedAt });
  } else {
    await ctx.db.insert("userPreferences", {
      userId,
      preferredLanguage: language,
      updatedAt,
    });
  }
  return language;
}

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
      await ctx.db.insert("userPreferences", {
        userId,
        preferredLanguage: "EN",
        updatedAt: Date.now(),
      });
    }
    const appUser = await ctx.db.query("appUsers")
      .withIndex("by_userId", (index) => index.eq("userId", userId)).unique();
    if (!appUser) {
      await ctx.db.insert("appUsers", {
        userId, role: "admin", status: "active", joinedAt: Date.now(),
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
    v.object({ status: v.literal("invitationRequired") }),
    v.object({
      status: v.literal("ready"),
      userId: v.id("users"),
      email: v.union(v.string(), v.null()),
      preferredLanguage: languageValidator,
      role: v.union(v.literal("admin"), v.literal("member")),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = await getAuthUserId(ctx);
    if (!userId || identity?.subject !== args.subject) return { status: "denied" as const };
    const [user, owner, preferences, appUser] = await Promise.all([
      ctx.db.get(userId),
      ctx.db.query("appOwners").withIndex("by_key", (q) => q.eq("key", ownerKey)).unique(),
      ctx.db.query("userPreferences").withIndex("by_userId", (q) => q.eq("userId", userId)).unique(),
      ctx.db.query("appUsers").withIndex("by_userId", (q) => q.eq("userId", userId)).unique(),
    ]);
    if (appUser?.status === "suspended") return { status: "denied" as const };
    const isLegacyOwner = owner?.userId === userId;
    if (!appUser && !isLegacyOwner) {
      return user?.email?.trim().toLowerCase() === env.APP_OWNER_EMAIL.trim().toLowerCase() && !owner
        ? { status: "setup" as const }
        : { status: "invitationRequired" as const };
    }
    return {
      status: "ready" as const,
      userId,
      email: user?.email ?? null,
      preferredLanguage: preferences?.preferredLanguage ?? "EN",
      role: appUser?.role ?? "admin",
    };
  },
});

export const setPreferredLanguage = mutation({
  args: { language: languageValidator },
  returns: languageValidator,
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx);
    return await writePreferredLanguage(ctx, userId, args.language);
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
    await assertActiveUser(ctx, args.userId);
    return null;
  },
});

export const getPreferredLanguageForOwner = internalQuery({
  args: { userId: v.id("users") },
  returns: languageValidator,
  handler: async (ctx, args) => {
    await assertActiveUser(ctx, args.userId);
    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (index) => index.eq("userId", args.userId))
      .unique();
    return preferences?.preferredLanguage ?? "EN";
  },
});

export const setPreferredLanguageForOwner = internalMutation({
  args: { userId: v.id("users"), language: languageValidator },
  returns: languageValidator,
  handler: async (ctx, args) => {
    await assertActiveUser(ctx, args.userId);
    return await writePreferredLanguage(ctx, args.userId, args.language);
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

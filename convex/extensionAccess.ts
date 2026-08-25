import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOwner } from "./ownership";

const accessKey = "primary" as const;

export const getStatus = query({
  args: {},
  returns: v.object({
    connected: v.boolean(),
    updatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const ownerId = await requireOwner(ctx);
    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_key", (index) => index.eq("key", accessKey))
      .unique();
    if (access && access.ownerId !== ownerId) {
      throw new ConvexError("This lexicon belongs to another account.");
    }
    return {
      connected: access?.tokenHash !== null && access?.tokenHash !== undefined,
      updatedAt: access?.updatedAt ?? null,
    };
  },
});

export const revoke = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const ownerId = await requireOwner(ctx);
    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_key", (index) => index.eq("key", accessKey))
      .unique();
    if (!access) return null;
    if (access.ownerId !== ownerId) {
      throw new ConvexError("This lexicon belongs to another account.");
    }
    await ctx.db.patch(access._id, {
      pairingCodeHash: null,
      pairingExpiresAt: null,
      tokenHash: null,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const storePairingCode = internalMutation({
  args: {
    ownerId: v.id("users"),
    codeHash: v.string(),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await ctx.db
      .query("appOwners")
      .withIndex("by_key", (index) => index.eq("key", accessKey))
      .unique();
    if (owner?.userId !== args.ownerId) {
      throw new ConvexError("This lexicon belongs to another account.");
    }

    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_key", (index) => index.eq("key", accessKey))
      .unique();
    const now = Date.now();
    if (access) {
      if (access.ownerId !== args.ownerId) {
        throw new ConvexError("This lexicon belongs to another account.");
      }
      await ctx.db.patch(access._id, {
        pairingCodeHash: args.codeHash,
        pairingExpiresAt: args.expiresAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("extensionAccess", {
        key: accessKey,
        ownerId: args.ownerId,
        pairingCodeHash: args.codeHash,
        pairingExpiresAt: args.expiresAt,
        tokenHash: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const activateToken = internalMutation({
  args: {
    codeHash: v.string(),
    tokenHash: v.string(),
    now: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_key", (index) => index.eq("key", accessKey))
      .unique();
    if (
      !access ||
      access.pairingCodeHash !== args.codeHash ||
      access.pairingExpiresAt === null ||
      access.pairingExpiresAt < args.now
    ) {
      return false;
    }
    const owner = await ctx.db
      .query("appOwners")
      .withIndex("by_key", (index) => index.eq("key", accessKey))
      .unique();
    if (owner?.userId !== access.ownerId) return false;

    await ctx.db.patch(access._id, {
      pairingCodeHash: null,
      pairingExpiresAt: null,
      tokenHash: args.tokenHash,
      updatedAt: args.now,
    });
    return true;
  },
});

export const authenticateToken = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_key", (index) => index.eq("key", accessKey))
      .unique();
    if (!access?.tokenHash || access.tokenHash !== args.tokenHash) return null;
    const owner = await ctx.db
      .query("appOwners")
      .withIndex("by_key", (index) => index.eq("key", accessKey))
      .unique();
    return owner?.userId === access.ownerId ? access.ownerId : null;
  },
});

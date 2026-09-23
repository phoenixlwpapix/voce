import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOwner } from "./ownership";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

async function isActiveUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const member = await ctx.db.query("appUsers")
    .withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
  if (member) return member.status === "active";
  const owner = await ctx.db.query("appOwners")
    .withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
  return owner !== null;
}

async function assertActiveUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  if (!(await isActiveUser(ctx, userId))) throw new ConvexError("Account access required.");
}

const deviceValidator = v.object({
  id: v.union(v.id("extensionDevices"), v.literal("legacy")),
  name: v.string(),
  connectedAt: v.number(),
});

export const listDevices = query({
  args: {},
  returns: v.array(deviceValidator),
  handler: async (ctx) => {
    const ownerId = await requireOwner(ctx);
    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_ownerId", (index) => index.eq("ownerId", ownerId))
      .unique();
    if (access && access.ownerId !== ownerId) {
      throw new ConvexError("This lexicon belongs to another account.");
    }
    const devices = await ctx.db
      .query("extensionDevices")
      .withIndex("by_ownerId_and_updatedAt", (index) => index.eq("ownerId", ownerId))
      .order("desc")
      .take(50);
    const result: Array<{
      id: (typeof devices)[number]["_id"] | "legacy";
      name: string;
      connectedAt: number;
    }> = devices.map((device) => ({
      id: device._id,
      name: device.name,
      connectedAt: device.updatedAt,
    }));
    if (access?.tokenHash) {
      result.push({
        id: "legacy",
        name: "Previously connected Chrome",
        connectedAt: access.updatedAt,
      });
    }
    return result;
  },
});

export const revoke = mutation({
  args: {
    deviceId: v.union(v.id("extensionDevices"), v.literal("legacy")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    if (args.deviceId !== "legacy") {
      const device = await ctx.db.get("extensionDevices", args.deviceId);
      if (!device || device.ownerId !== ownerId) {
        throw new ConvexError("This device connection was not found.");
      }
      await ctx.db.delete("extensionDevices", device._id);
      return null;
    }

    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_ownerId", (index) => index.eq("ownerId", ownerId))
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
    await assertActiveUser(ctx, args.ownerId);

    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_ownerId", (index) => index.eq("ownerId", args.ownerId))
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
        key: args.ownerId,
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
    deviceId: v.string(),
    deviceName: v.string(),
    now: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_pairingCodeHash", (index) => index.eq("pairingCodeHash", args.codeHash))
      .unique();
    if (
      !access ||
      access.pairingCodeHash !== args.codeHash ||
      access.pairingExpiresAt === null ||
      access.pairingExpiresAt < args.now
    ) {
      return false;
    }
    if (!(await isActiveUser(ctx, access.ownerId))) return false;

    const device = await ctx.db
      .query("extensionDevices")
      .withIndex("by_ownerId_and_deviceId", (index) =>
        index.eq("ownerId", access.ownerId).eq("deviceId", args.deviceId),
      )
      .unique();
    if (device) {
      await ctx.db.patch(device._id, {
        name: args.deviceName,
        tokenHash: args.tokenHash,
        updatedAt: args.now,
      });
    } else {
      await ctx.db.insert("extensionDevices", {
        ownerId: access.ownerId,
        deviceId: args.deviceId,
        name: args.deviceName,
        tokenHash: args.tokenHash,
        createdAt: args.now,
        updatedAt: args.now,
      });
    }

    await ctx.db.patch(access._id, {
      pairingCodeHash: null,
      pairingExpiresAt: null,
      updatedAt: args.now,
    });
    return true;
  },
});

export const authenticateToken = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("extensionDevices")
      .withIndex("by_tokenHash", (index) => index.eq("tokenHash", args.tokenHash))
      .unique();
    if (device) {
      return (await isActiveUser(ctx, device.ownerId)) ? device.ownerId : null;
    }

    const access = await ctx.db
      .query("extensionAccess")
      .withIndex("by_tokenHash", (index) => index.eq("tokenHash", args.tokenHash))
      .unique();
    if (!access?.tokenHash || access.tokenHash !== args.tokenHash) return null;
    return (await isActiveUser(ctx, access.ownerId)) ? access.ownerId : null;
  },
});

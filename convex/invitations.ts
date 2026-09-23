import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const lifetimeMs = 7 * 24 * 60 * 60 * 1000;

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
  if (!userId) throw new ConvexError("Please sign in to continue.");
  const member = await ctx.db.query("appUsers")
    .withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
  if (member) {
    if (member.role !== "admin" || member.status !== "active") throw new ConvexError("Admin access required.");
    return userId;
  }
  const owner = await ctx.db.query("appOwners")
    .withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
  if (!owner) throw new ConvexError("Admin access required.");
  return userId;
}

export const store = internalMutation({
  args: { createdBy: v.id("users"), tokenHash: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const member = await ctx.db.query("appUsers")
      .withIndex("by_userId", (q) => q.eq("userId", args.createdBy)).unique();
    const owner = await ctx.db.query("appOwners")
      .withIndex("by_userId", (q) => q.eq("userId", args.createdBy)).unique();
    if (member ? member.role !== "admin" || member.status !== "active" : !owner) {
      throw new ConvexError("Admin access required.");
    }
    const now = Date.now();
    const expiresAt = now + lifetimeMs;
    await ctx.db.insert("invitations", {
      tokenHash: args.tokenHash, createdBy: args.createdBy, createdAt: now, expiresAt,
    });
    return expiresAt;
  },
});

export const redeem = internalMutation({
  args: { userId: v.id("users"), tokenHash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.query("invitations")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash)).unique();
    if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt < Date.now()) {
      throw new ConvexError("This invitation is invalid, expired, or already used.");
    }
    const existing = await ctx.db.query("appUsers")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId)).unique();
    if (existing) throw new ConvexError("This account already has access.");
    const owner = await ctx.db.query("appOwners")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId)).unique();
    if (owner) throw new ConvexError("This account already has access.");
    const user = await ctx.db.get(args.userId);
    if (!user?.email) throw new ConvexError("Register with an email address to accept this invitation.");
    const now = Date.now();
    await ctx.db.insert("appUsers", {
      userId: args.userId, role: "member", status: "active", invitedBy: invitation.createdBy, joinedAt: now,
    });
    await ctx.db.insert("userPreferences", {
      userId: args.userId, preferredLanguage: "EN", updatedAt: now,
    });
    await ctx.db.patch(invitation._id, { acceptedBy: args.userId, acceptedAt: now });
    return null;
  },
});

export const list = query({
  args: {},
  returns: v.array(v.object({
    id: v.id("invitations"), createdAt: v.number(), expiresAt: v.number(),
    acceptedAt: v.union(v.number(), v.null()), revokedAt: v.union(v.number(), v.null()),
  })),
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    const invitations = await ctx.db.query("invitations")
      .withIndex("by_createdBy_and_createdAt", (q) => q.eq("createdBy", adminId))
      .order("desc").take(50);
    return invitations.map((item) => ({
      id: item._id, createdAt: item.createdAt, expiresAt: item.expiresAt,
      acceptedAt: item.acceptedAt ?? null, revokedAt: item.revokedAt ?? null,
    }));
  },
});

export const revoke = mutation({
  args: { id: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const invitation = await ctx.db.get(args.id);
    if (!invitation || invitation.createdBy !== adminId) throw new ConvexError("Invitation not found.");
    if (!invitation.acceptedAt && !invitation.revokedAt) {
      await ctx.db.patch(args.id, { revokedAt: Date.now() });
    }
    return null;
  },
});

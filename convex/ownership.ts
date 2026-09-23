import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type OwnershipCtx = QueryCtx | MutationCtx;

export async function requireOwner(ctx: OwnershipCtx): Promise<Id<"users">> {
  const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
  if (userId === null) {
    throw new ConvexError("Please sign in to continue.");
  }

  const member = await ctx.db.query("appUsers")
    .withIndex("by_userId", (index) => index.eq("userId", userId)).unique();
  if (member) {
    if (member.status !== "active") throw new ConvexError("This account is suspended.");
    return userId;
  }
  const owner = await ctx.db.query("appOwners")
    .withIndex("by_userId", (index) => index.eq("userId", userId)).unique();
  if (!owner) throw new ConvexError("This account has not been invited.");

  return userId;
}

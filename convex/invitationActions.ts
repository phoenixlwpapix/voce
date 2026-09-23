"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { createHash, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const create = action({
  args: {},
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx): Promise<{ token: string; expiresAt: number }> => {
    const createdBy = (await getAuthUserId(ctx)) as Id<"users"> | null;
    if (!createdBy) throw new ConvexError("Please sign in to continue.");
    const token = randomBytes(32).toString("base64url");
    const expiresAt: number = await ctx.runMutation(internal.invitations.store, {
      createdBy, tokenHash: hashToken(token),
    });
    return { token, expiresAt };
  },
});

export const accept = action({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
    if (!userId) throw new ConvexError("Please sign in to continue.");
    if (!/^[A-Za-z0-9_-]{43}$/.test(args.token)) throw new ConvexError("Invalid invitation link.");
    return await ctx.runMutation(internal.invitations.redeem, {
      userId, tokenHash: hashToken(args.token),
    });
  },
});

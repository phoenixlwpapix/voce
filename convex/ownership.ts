import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type OwnershipCtx = QueryCtx | MutationCtx;

export async function requireOwner(ctx: OwnershipCtx): Promise<Id<"users">> {
  const userId = (await getAuthUserId(ctx)) as Id<"users"> | null;
  if (userId === null) {
    throw new ConvexError("请先登录后再继续。");
  }

  const owner = await ctx.db
    .query("appOwners")
    .withIndex("by_key", (index) => index.eq("key", "primary"))
    .unique();

  if (owner?.userId !== userId) {
    throw new ConvexError("这个词汇簿已绑定其他账号。");
  }

  return userId;
}

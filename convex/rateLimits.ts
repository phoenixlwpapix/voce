import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Each Gemini-backed request (a new word lookup or a Chinese search) spends
  // one token: bursts of 30, refilling at 60 per hour for each account.
  generation: { kind: "token bucket", rate: 60, period: HOUR, capacity: 30 },
});

export async function consumeGenerationQuota(ctx: ActionCtx, ownerId: Id<"users">) {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, "generation", { key: ownerId });
  if (!ok) {
    const minutes = Math.max(1, Math.ceil(retryAfter / 60_000));
    throw new ConvexError(`You've reached the hourly lookup limit. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
}

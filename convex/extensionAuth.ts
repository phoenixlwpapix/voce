"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { createHash, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { lookupAndSaveForOwner } from "./lookupCore";
import { languageValidator } from "./validators";

const pairingLifetimeMs = 10 * 60 * 1000;
const pairingAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const pairingPattern = /^VOCE-[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function hashSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function createPairingCode() {
  const bytes = randomBytes(10);
  const value = Array.from(bytes, (byte) => pairingAlphabet[byte % pairingAlphabet.length]).join("");
  return `VOCE-${value.slice(0, 5)}-${value.slice(5)}`;
}

export const createPairingCodeForOwner = action({
  args: {},
  returns: v.object({ code: v.string(), expiresAt: v.number() }),
  handler: async (ctx) => {
    const ownerId = (await getAuthUserId(ctx)) as Id<"users"> | null;
    if (ownerId === null) {
      throw new ConvexError("Please sign in to continue.");
    }
    await ctx.runQuery(internal.account.assertOwner, { userId: ownerId });

    const code = createPairingCode();
    const expiresAt = Date.now() + pairingLifetimeMs;
    await ctx.runMutation(internal.extensionAccess.storePairingCode, {
      ownerId,
      codeHash: hashSecret(code),
      expiresAt,
    });
    return { code, expiresAt };
  },
});

export const redeemPairingCode = internalAction({
  args: { code: v.string() },
  returns: v.union(v.object({ token: v.string() }), v.null()),
  handler: async (ctx, args): Promise<{ token: string } | null> => {
    const code = args.code.trim().toUpperCase();
    if (!pairingPattern.test(code)) return null;

    const token = randomBytes(32).toString("base64url");
    const activated: boolean = await ctx.runMutation(internal.extensionAccess.activateToken, {
      codeHash: hashSecret(code),
      tokenHash: hashSecret(token),
      now: Date.now(),
    });
    return activated ? { token } : null;
  },
});

export const lookupFromExtension = internalAction({
  args: {
    token: v.string(),
    inputWord: v.string(),
    language: languageValidator,
    monthGroup: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      result: v.object({
        id: v.id("words"),
        status: v.union(v.literal("created"), v.literal("refreshed")),
        word: v.string(),
      }),
    }),
    v.object({ ok: v.literal(false) }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; result: { id: Id<"words">; status: "created" | "refreshed"; word: string } }
    | { ok: false }
  > => {
    if (!tokenPattern.test(args.token)) return { ok: false as const };
    const ownerId: Id<"users"> | null = await ctx.runQuery(internal.extensionAccess.authenticateToken, {
      tokenHash: hashSecret(args.token),
    });
    if (ownerId === null) return { ok: false as const };

    const result = await lookupAndSaveForOwner(ctx, {
      ownerId,
      inputWord: args.inputWord,
      language: args.language,
      monthGroup: args.monthGroup,
    });
    return { ok: true as const, result };
  },
});

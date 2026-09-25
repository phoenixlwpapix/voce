import { ConvexError } from "convex/values";
import { env, type MutationCtx } from "./_generated/server";

const invitationTokenPattern = /^[A-Za-z0-9_-]{43}$/;

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Voce is invite-only: a new account needs a redeemable invitation, except for
// the configured owner email that bootstraps the lexicon. The invitation is
// only checked here; it is consumed when the new member accepts it.
export async function assertSignUpAllowed(ctx: MutationCtx, email: string, inviteToken: string | undefined) {
  if (email.trim().toLowerCase() === env.APP_OWNER_EMAIL.trim().toLowerCase()) return;

  if (inviteToken && invitationTokenPattern.test(inviteToken)) {
    const tokenHash = await sha256Hex(inviteToken);
    const invitation = await ctx.db.query("invitations")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (invitation && !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt >= Date.now()) return;
  }
  throw new ConvexError("Voce is invite-only. Open your invitation link to create an account.");
}

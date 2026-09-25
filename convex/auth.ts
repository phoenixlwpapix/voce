import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import { assertSignUpAllowed } from "./signUpPolicy";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        // The invite token only travels to createOrUpdateUser below; it is never stored.
        const inviteToken = typeof params.inviteToken === "string" ? params.inviteToken : undefined;
        return { email: params.email as string, ...(inviteToken ? { inviteToken } : {}) };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (existingUserId) return existingUserId;
      const email = String(profile.email ?? "");
      const inviteToken = typeof profile.inviteToken === "string" ? profile.inviteToken : undefined;
      await assertSignUpAllowed(ctx as unknown as MutationCtx, email, inviteToken);
      return await ctx.db.insert("users", { email });
    },
  },
});

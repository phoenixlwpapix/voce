/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.unstubAllEnvs());

test("one-use invitation activates a separate personal lexicon", async () => {
  vi.stubEnv("APP_OWNER_EMAIL", "owner@example.test");
  const t = convexTest(schema, modules);
  const [owner, friend, outsider] = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { email: "owner@example.test" });
    const friend = await ctx.db.insert("users", { email: "friend@example.test" });
    const outsider = await ctx.db.insert("users", { email: "outsider@example.test" });
    await ctx.db.insert("appOwners", { key: "primary", userId: owner, createdAt: 1 });
    await ctx.db.insert("words", {
      ownerId: owner, inputWord: "hello", normalizedWord: "hello", word: "hello",
      language: "EN", phonetic: "", definitions: [], examples: [], monthGroup: "2026-09",
      repetitions: 0, intervalDays: 0, easeFactor: 2.5, nextReviewAt: 1,
      createdAt: 1, updatedAt: 1,
    });
    return [owner, friend, outsider] as const;
  });
  const admin = t.withIdentity({ subject: `${owner}|session` });
  const invited = t.withIdentity({ subject: `${friend}|session` });
  const uninvited = t.withIdentity({ subject: `${outsider}|session` });
  const { token } = await admin.action(api.invitationActions.create);
  expect(await invited.query(api.account.session, { subject: `${friend}|session` }))
    .toEqual({ status: "invitationRequired" });
  await invited.action(api.invitationActions.accept, { token });
  expect(await invited.query(api.account.session, { subject: `${friend}|session` }))
    .toMatchObject({ status: "ready", role: "member", preferredLanguage: "EN" });
  expect(await invited.query(api.words.getWordsByMonth, { language: "EN" })).toEqual([]);
  const pairing = await invited.action(api.extensionAuth.createPairingCodeForOwner);
  expect(pairing.code).toMatch(/^VOCE-/);
  expect(await admin.query(api.words.getWordsByMonth, { language: "EN" }))
    .toMatchObject([{ word: "hello" }]);
  await expect(uninvited.action(api.invitationActions.accept, { token })).rejects.toThrow();
  await expect(invited.action(api.invitationActions.create)).rejects.toThrow();
  await expect(uninvited.query(api.words.getWordsByMonth, { language: "EN" })).rejects.toThrow();
});

test("revoked invitation cannot be redeemed", async () => {
  vi.stubEnv("APP_OWNER_EMAIL", "owner@example.test");
  const t = convexTest(schema, modules);
  const [owner, friend] = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { email: "owner@example.test" });
    const friend = await ctx.db.insert("users", { email: "friend@example.test" });
    await ctx.db.insert("appOwners", { key: "primary", userId: owner, createdAt: 1 });
    return [owner, friend] as const;
  });
  const admin = t.withIdentity({ subject: `${owner}|session` });
  const { token } = await admin.action(api.invitationActions.create);
  const [invitation] = await admin.query(api.invitations.list);
  await admin.mutation(api.invitations.revoke, { id: invitation.id });
  await expect(t.withIdentity({ subject: `${friend}|session` })
    .action(api.invitationActions.accept, { token })).rejects.toThrow();
});

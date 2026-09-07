/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

async function setup() {
  vi.stubEnv("APP_OWNER_EMAIL", "owner@example.test");
  const t = convexTest(schema, modules);
  const [owner, other] = await t.run(async (ctx) => Promise.all([
    ctx.db.insert("users", { email: "owner@example.test" }),
    ctx.db.insert("users", { email: "other@example.test" }),
  ]));
  const subject = `${owner}|session`;
  return { t, owner, other, subject, signedIn: t.withIdentity({ subject }) };
}

test("unauthenticated and non-allowlisted accounts cannot read or initialize", async () => {
  const { t, other, subject } = await setup();
  expect(await t.query(api.account.session, { subject })).toEqual({ status: "denied" });
  const denied = t.withIdentity({ subject: `${other}|session` });
  expect(await denied.query(api.account.session, { subject: `${other}|session` })).toEqual({ status: "denied" });
  await expect(denied.mutation(api.account.claimOwnership)).rejects.toThrow();
  await expect(denied.query(api.words.getWordsByMonth, {})).rejects.toThrow();
});

test("setup runs once and repeated claims do not schedule another migration", async () => {
  vi.useFakeTimers();
  const { t, signedIn, owner, subject } = await setup();
  expect(await signedIn.query(api.account.session, { subject })).toEqual({ status: "setup" });
  await signedIn.mutation(api.account.claimOwnership);
  expect(await signedIn.query(api.account.session, { subject })).toMatchObject({ status: "ready", userId: owner });
  await signedIn.mutation(api.account.claimOwnership);
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs).toHaveLength(1);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test("a spoofed session subject is denied even for a signed-in owner", async () => {
  const { t, signedIn, owner, other } = await setup();
  await t.run((ctx) => ctx.db.insert("appOwners", { key: "primary", userId: owner, createdAt: 1 }));
  expect(await signedIn.query(api.account.session, { subject: `${other}|session` })).toEqual({ status: "denied" });
  await expect(t.withIdentity({ subject: `${other}|session` }).query(api.words.getWordsByMonth, {})).rejects.toThrow();
});

/// <reference types="vite/client" />
import { createHash } from "node:crypto";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function hashSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("an authenticated extension reads and updates the account language", async () => {
  const t = convexTest(schema, modules);
  const token = "a".repeat(43);
  const ownerId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "owner@example.test" });
    await ctx.db.insert("appOwners", { key: "primary", userId, createdAt: 1 });
    await ctx.db.insert("userPreferences", {
      userId,
      preferredLanguage: "FR",
      updatedAt: 1,
    });
    await ctx.db.insert("extensionDevices", {
      ownerId: userId,
      deviceId: "00000000-0000-4000-8000-000000000000",
      name: "Chrome test",
      tokenHash: hashSecret(token),
      createdAt: 1,
      updatedAt: 1,
    });
    return userId;
  });

  await expect(
    t.action(internal.extensionAuth.getPreferredLanguageFromExtension, { token }),
  ).resolves.toEqual({ ok: true, language: "FR" });
  await expect(
    t.action(internal.extensionAuth.setPreferredLanguageFromExtension, {
      token,
      language: "ES",
    }),
  ).resolves.toEqual({ ok: true, language: "ES" });
  const preference = await t.run((ctx) =>
    ctx.db
      .query("userPreferences")
      .withIndex("by_userId", (index) => index.eq("userId", ownerId))
      .unique(),
  );
  expect(preference?.preferredLanguage).toBe("ES");
});

test("an invalid extension token cannot read or update the language", async () => {
  const t = convexTest(schema, modules);
  const token = "b".repeat(43);
  await expect(
    t.action(internal.extensionAuth.getPreferredLanguageFromExtension, { token }),
  ).resolves.toEqual({ ok: false });
  await expect(
    t.action(internal.extensionAuth.setPreferredLanguageFromExtension, {
      token,
      language: "JA",
    }),
  ).resolves.toEqual({ ok: false });
});

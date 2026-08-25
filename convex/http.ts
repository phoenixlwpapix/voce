import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function isLanguage(value: unknown): value is "EN" | "FR" | "ES" | "JA" {
  return value === "EN" || value === "FR" || value === "ES" || value === "JA";
}

function getSafeLookupError(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  return "The lookup couldn't be completed. Try again shortly.";
}

http.route({
  path: "/api/extension/pair",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Enter a valid pairing code." }, 400);
    }
    if (!body || typeof body !== "object" || !("code" in body) || typeof body.code !== "string") {
      return jsonResponse({ error: "Enter a valid pairing code." }, 400);
    }

    const result = await ctx.runAction(internal.extensionAuth.redeemPairingCode, {
      code: body.code,
    });
    return result
      ? jsonResponse(result)
      : jsonResponse({ error: "The pairing code is invalid or expired." }, 400);
  }),
});

http.route({
  path: "/api/extension/lookup",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) {
      return jsonResponse({ error: "Reconnect the extension to Voce." }, 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Enter a valid word." }, 400);
    }
    if (
      !body ||
      typeof body !== "object" ||
      !("word" in body) ||
      typeof body.word !== "string" ||
      !("language" in body) ||
      !isLanguage(body.language) ||
      !("monthGroup" in body) ||
      typeof body.monthGroup !== "string"
    ) {
      return jsonResponse({ error: "The lookup request is invalid." }, 400);
    }

    try {
      const result = await ctx.runAction(internal.extensionAuth.lookupFromExtension, {
        token,
        inputWord: body.word,
        language: body.language,
        monthGroup: body.monthGroup,
      });
      if (!result.ok) {
        return jsonResponse({ error: "Reconnect the extension to Voce." }, 401);
      }
      return jsonResponse(result.result);
    } catch (error) {
      return jsonResponse({ error: getSafeLookupError(error) }, 502);
    }
  }),
});

export default http;

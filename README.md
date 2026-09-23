# Voce

Voce is a quiet, single-user multilingual vocabulary notebook for collecting and reviewing English, French, Spanish, and Japanese words. Gemini creates validated Chinese learning notes, Convex stores and streams the collection in real time, a deterministic two-button scheduler powers review, and a private Chrome companion saves words from any page.

The editorial interface uses English throughout and includes a responsive split-screen sign-in cover built around Voce's open-book mark. The signed-in home view keeps Review in the masthead and groups extension setup, appearance, CSV export, and sign-out in Settings on both phone and desktop. On phones, the heading and lookup form use less vertical space, lookup direction sits beside the input, and timeline search and month filtering share a row so the newest word and its Chinese meaning appear sooner. Month and count headings remain visible while scrolling each month's entries, until the next month takes over. Each vocabulary row toggles its full learning details when clicked or activated from the keyboard, while its pronunciation control remains independent. Lookup placeholders stay native to English, French, Spanish, and Japanese, while generated learning definitions and translations remain in Simplified Chinese.

Each account has one active learning language. New accounts start in English; choosing English, French, Spanish, or Japanese on the home screen saves that preference in Convex, filters the timeline at the query boundary, and restores the same language on the next visit or another device. Review opens directly into all due words for that active language.

The timeline can export the vocabulary collection as a UTF-8 CSV for local use. Export defaults to the active learning language, with an optional all-languages range; the file includes pronunciation, Chinese definitions, grammar notes, examples, and record dates. Export reads the full matching collection through an authorized paginated query rather than being limited to the timeline's first 500 cached entries.

The home lookup supports two explicit directions through one compact language-swap control beside the input: **ES → 中文**, for example, reverses to **中文 → ES** when clicked. Foreign-language → Chinese validates and saves vocabulary already written in the active language. Chinese → foreign-language accepts a meaningful Simplified Chinese word or short phrase and asks Gemini for one to three common expressions in the active language. Suggestions are ranked and include concise Chinese meaning and usage distinctions; nothing is stored until the user chooses a candidate, which then passes through the normal strict-language lookup, deduplication, and save flow. An explicit direction avoids confusing Chinese text with Japanese kanji.

Production: https://voce-fawn.vercel.app

## Stack

- Next.js 16, React 19, TypeScript strict mode, App Router
- Convex database, queries, mutations, and Node actions
- Convex Auth email/password sessions with a single-owner authorization boundary
- Gemini `gemini-3.5-flash-lite` through the official `@google/genai` SDK
- Tailwind CSS v4 and accessible Radix/shadcn-style primitives
- Zod validation, Lucide icons, Sonner notifications
- Installable PWA shell with route and static-asset caching

## Prerequisites

- Node.js 20.9 or newer
- pnpm 10 or newer
- A Convex account and project
- A Gemini API key from Google AI Studio

## Install

```bash
pnpm install
```

Copy the environment template:

```bash
cp .env.example .env.local
```

On PowerShell, use `Copy-Item .env.example .env.local`.

## Convex setup

Connect the repository to a Convex deployment and start schema/function syncing:

```bash
pnpm dev:convex
```

The command creates or updates `NEXT_PUBLIC_CONVEX_URL` in `.env.local` and regenerates `convex/_generated`. Keep it running beside the Next.js development server. In the Convex dashboard, add `GEMINI_API_KEY` under the deployment environment variables. The key belongs to the Convex action environment; do not prefix it with `NEXT_PUBLIC_` or place it in browser code.

Convex Auth also needs `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` on every deployment. They are already configured on the current development deployment. Generate a different signing key pair for production; never copy the private key into `.env.local` or a public hosting environment variable.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Browser | URL of the connected Convex deployment |
| `GEMINI_API_KEY` | Convex action | Server-only Gemini credential |
| `APP_OWNER_EMAIL` | Convex functions | Only email allowed to claim and use the personal notebook |
| `JWT_PRIVATE_KEY` | Convex Auth | Server-only session signing private key |
| `JWKS` | Convex Auth | Public key set used to verify sessions |
| `SITE_URL` | Convex Auth | Public frontend origin, such as `https://voce-fawn.vercel.app` |

`.env.example` documents both values. For local Convex development, configure the Gemini secret with the dashboard or `pnpm convex env set GEMINI_API_KEY your-key`.

## Local development

Start Next.js and Convex together:

```bash
pnpm dev
```

To run either process separately, use:

```bash
pnpm dev:next
pnpm dev:convex
```

Open `http://localhost:3000`. The lookup month is generated in the browser's local timezone before the request is sent.

## Progressive Web App

Production builds register `/sw.js` and expose `/manifest.webmanifest`, so Voce can be installed from a supporting browser. Visited pages and their same-origin static assets are cached for later offline reopening; an uncached route falls back to the standalone offline screen.

Convex responses and authentication data are deliberately not written to the service-worker cache. Existing screens can remain visible during a temporary disconnect, but signing in, syncing vocabulary, Gemini lookups, and mutations require a network connection. The in-app connection banner disappears automatically after reconnecting.

Service workers require HTTPS in production. Localhost is treated as a secure origin, but registration is disabled under `pnpm dev` to prevent stale development bundles; use `pnpm build` followed by `pnpm start` for local PWA testing. Regenerate install icons after changing the brand mark with:

```powershell
pwsh -ExecutionPolicy Bypass -File .\scripts\generate-pwa-icons.ps1
```

## Chrome extension

The unpacked Manifest V3 extension lives in `extension/` and talks only to the production Convex Site endpoint. It supports manual lookup from the toolbar popup and an **Add “selection” to Voce** context-menu action on selected page text. The extension reads the account's current learning language when it opens, writes popup language changes back to the same account preference, and refreshes the preference before a context-menu lookup. Selected text never changes the language automatically.

Install and pair it:

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select this repository's `extension` directory.
3. Sign in to Voce and open `/extension` from the header.
4. Generate a one-time pairing code, open the extension popup, and redeem the code within ten minutes.

The extension requests only `contextMenus`, `storage`, and host access to `https://grateful-caterpillar-393.convex.site/*`. It injects no content script and does not request browser-history or all-sites read access. Pairing codes and access tokens are stored only as SHA-256 hashes in Convex; each installation keeps its own device ID and access token in extension-local storage restricted to trusted extension contexts. Pairing another computer does not invalidate existing devices, and each device can be revoked independently from `/extension`.

Validate the unpacked extension source with:

```bash
pnpm check:extension
```

If the production Convex deployment name changes, update both `host_permissions` in `extension/manifest.json` and `apiBase` in `extension/api.mjs` before reloading the extension.

## First account

Choose **Create account** on the login screen and register with the email configured as `APP_OWNER_EMAIL` and a password of at least eight characters. That account becomes the only owner of this personal notebook. Existing words are assigned to it automatically in batches.

Later accounts may authenticate but cannot read, edit, delete, review, or create words, and are rejected before a Gemini request is made. Create the owner account before exposing a new deployment publicly.

## Verification and production build

```bash
pnpm typecheck
pnpm lint
pnpm check:extension
pnpm build
```

Start the compiled application with `pnpm start`.

## Deployment

1. Deploy Convex functions with `pnpm convex deploy` and configure `GEMINI_API_KEY`, `APP_OWNER_EMAIL`, `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` on the production Convex deployment.
2. Add the production `NEXT_PUBLIC_CONVEX_URL` to the Next.js hosting provider.
3. Build with `pnpm build` and deploy the Next.js output. Vercel works without additional adapters.

The live production backend for this project is `grateful-caterpillar-393` at `https://grateful-caterpillar-393.convex.cloud`. The Vercel project is connected to the private `phoenixlwpapix/voce` GitHub repository and deploys from `main`.

The Gemini and JWT private keys must never be configured as public Next.js environment variables. Authentication is paired with server-side single-owner authorization: hiding the UI alone is not treated as protection.

## Review shortcuts

Opening `/review` immediately starts the due queue for the account's active learning language. The language is changed only from the home screen; review does not accept a URL language override or ask for a separate language and date-range selection.

| Key | Action |
| --- | --- |
| `Space` | Play pronunciation |
| `Enter` | Flip the current card |
| `1` | Mark as forgot after flipping |
| `2` | Mark as remembered after flipping |
| `Escape` | Return to the timeline |

Shortcuts are ignored while an input, textarea, select, or editable element is focused. Pronunciation uses the browser Web Speech API with exact-locale, language-prefix, then default-voice fallback.

Generated pronunciation is stored as IPA for English, French, and Spanish, and as a Hiragana reading for Japanese. Language-specific generation guidance also checks agreement inside examples, including Spanish and French reflexive or pronominal verbs used after a conjugated modal or another verb. Japanese word forms use a dedicated Japanese font and language-aware line height to avoid glyph clipping at display sizes.

## Cache-first timeline

After authentication, the home shell appears while a read-only session query verifies the owner. Only an unclaimed, allowlisted account runs `claimOwnership`; legacy migration is scheduled when the owner is first created, not on every visit. All existing `requireOwner` checks remain enforced. The header shares the verified session instead of fetching the account again.

Once the server confirms the user, the timeline starts IndexedDB reading and its existing reactive Convex query in parallel. Cached words render while the live result is pending; live results (including an empty list) always win and update the cache automatically. Only the vocabulary region shows skeletons on a cache miss. The existing 500-word query limit also applies to this cache; it is not a backup of the entire database.

IndexedDB database `voce-lexicon-cache`, store `lexicons`, uses a deployment-URL + user-ID + language key. Each record is `{ version: 2, userId, language, updatedAt, words: WordDocument[] }`. Runtime validation rejects corrupt records, unknown versions, mismatched word owners, and words from another language. Storage failures silently fall back to Convex. Sign-out immediately unmounts personal UI while retaining isolated cache records for the next verified sign-in. Session changes remount personal state; an unverified last-user ID never grants access to a cache.

Offline reading works after identity confirmation. A fully offline cold start cannot safely confirm the current account, so it does not reveal cached words. There is no offline write queue, conflict resolution or TTL. Convex remains the sole cloud source of truth; the service worker still never caches auth or Convex responses.

Development-only `[Voce Perf]` logs report auth/owner readiness, cache/query readiness (milliseconds from navigation via `performance.now()`), word counts and cache age. Compare cold and warm reloads on the same signed-in browser/network before considering server preload or SSR; no production timing claim is implied.

Run `pnpm test` for IndexedDB isolation/corruption/failure tests and Convex initialization/authorization regressions. Also run `pnpm typecheck`, `pnpm lint` and `pnpm build`. For browser acceptance, verify a cold miss, warm cached render under network throttling, disconnect after authentication, sign-out/account switch, a live add/delete/review update, and blocked IndexedDB. Deploy the new Convex `account.session` query before deploying this frontend.

## Data behavior

- Valid inflected lookup forms (for example `children` or `me quejo`) can return an AI-suggested dictionary form (`child`, `quejarse`) before anything is saved. The web dialog and extension popup let the user save either the dictionary form or the entered form; choosing either performs a fresh validated lookup. The extension's right-click action asks the user to open the popup when a form choice is needed. Saved inflected entries show their base form in grammar details. The model supplies this relationship, so ambiguous or irregular forms still depend on its accuracy.
- Suspected misspellings are not saved. Gemini returns up to three correctly spelled candidates with language and a short Chinese meaning; the web dialog and extension popup let the user select one or return to editing. Selecting a candidate performs a fresh, authorized lookup, generates the correct entry and deduplicates it before saving. Valid inflections remain valid vocabulary; unrecognized input is rejected. A lexical change silently made by the model also requires confirmation, and explicit misspelling-form definitions are blocked. Right-click extension lookups report that nothing was saved and direct the user to the popup for correction.
- Normal new words still need one generation request. Spelling confirmation may require a second request unless the chosen word already exists. The lookup API now returns `created`, `existing`, `needs_confirmation` or `invalid`; consumers must only treat the first two as saved results. Deploy updated backend and clients together. Existing historical entries remain unchanged, and language/spelling accuracy still depends on the model; mocked regression tests verify write gating rather than prove model accuracy.

- New lookups are strict to the explicitly selected language. Gemini may only validate, define, or suggest spellings from that language; input belonging to another language returns `invalid`, is not identified or suggested, and never changes the saved preference. The server also rejects valid results and spelling candidates whose returned language differs from the request.
- Chinese-to-foreign lookup is suggestion-only: meaningful Chinese input returns at most three normalized, same-language candidates and performs no database write. Gibberish, instructions, unsupported names, overly broad text, non-Chinese input, and model responses in another language are rejected. Selecting a candidate performs a fresh normal lookup before saving, so existing entries still deduplicate without losing review progress.
- A matching existing entry in the selected language still returns without an AI call. Historical misclassified entries are not automatically reanalyzed or migrated. AI validation is not deterministic dictionary verification; tests mock generation to verify strict-language write gating and duplicate/progress preservation.

- Duplicate identity is `language + normalizedWord`; Unicode NFC normalization and locale-aware lowercasing preserve accented and Japanese text.
- All vocabulary queries, mutations, review updates, and Gemini actions require the authenticated app owner; duplicates are scoped to that owner.
- Extension requests authenticate with a single revocable token minted from an owner-only, one-time pairing code; raw pairing codes and tokens are never stored in Convex.
- Duplicate lookups return the existing entry before calling Gemini, leaving its generated content, review progress, and original month unchanged.
- The home timeline and review queue both follow the persisted active learning language. Vocabulary and due-review queries filter by that language on the server; the timeline can instantly search its loaded entries by word, pronunciation, infinitive, grammar note, part of speech, or Chinese definition.
- Gemini output is constrained by a JSON schema and validated again with Zod before any write.
- Review interval calculations run inside the Convex mutation.

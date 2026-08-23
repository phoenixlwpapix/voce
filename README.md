# Voce

Voce is a quiet, single-user multilingual vocabulary notebook for collecting and reviewing English, French, and Spanish words. Gemini creates validated Chinese learning notes, Convex stores and streams the collection in real time, and a deterministic two-button scheduler powers review.

The editorial interface uses English throughout and includes a responsive split-screen sign-in cover built around Voce's open-book mark. Lookup placeholders stay native to English, French, and Spanish, while generated learning definitions and translations remain in Simplified Chinese.

Production: https://voce-fawn.vercel.app

## Stack

- Next.js 16, React 19, TypeScript strict mode, App Router
- Convex database, queries, mutations, and Node actions
- Convex Auth email/password sessions with a single-owner authorization boundary
- Gemini `gemini-3.5-flash-lite` through the official `@google/genai` SDK
- Tailwind CSS v4 and accessible Radix/shadcn-style primitives
- Zod validation, Lucide icons, Sonner notifications

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

## First account

Choose **Create account** on the login screen and register with the email configured as `APP_OWNER_EMAIL` and a password of at least eight characters. That account becomes the only owner of this personal notebook. Existing words are assigned to it automatically in batches.

Later accounts may authenticate but cannot read, edit, delete, review, or create words, and are rejected before a Gemini request is made. Create the owner account before exposing a new deployment publicly.

## Verification and production build

```bash
pnpm typecheck
pnpm lint
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

Opening `/review` first shows a setup screen. Choose one language (`EN`, `FR`, or `ES`) and a collection range: the current month, the latest three calendar months, or all time. Only due words matching both choices enter the session, and the completion screen can return to the selector for another group.

| Key | Action |
| --- | --- |
| `Space` | Play pronunciation |
| `Enter` | Flip the current card |
| `1` | Mark as forgot after flipping |
| `2` | Mark as remembered after flipping |
| `Escape` | Return to the timeline |

Shortcuts are ignored while an input, textarea, select, or editable element is focused. Pronunciation uses the browser Web Speech API with exact-locale, language-prefix, then default-voice fallback.

## Data behavior

- Duplicate identity is `language + normalizedWord`; Unicode NFC normalization and locale-aware lowercasing preserve French and Spanish accents.
- All vocabulary queries, mutations, review updates, and Gemini actions require the authenticated app owner; duplicates are scoped to that owner.
- Refreshing a duplicate updates generated vocabulary content while retaining review progress and its original month.
- The home timeline follows the active lookup language; review sessions can independently select a language and collection-time range.
- Gemini output is constrained by a JSON schema and validated again with Zod before any write.
- Review interval calculations run inside the Convex mutation.

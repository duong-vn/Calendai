# Calendai — Project Instructions & Durable Rules

## Project Overview
Calendai is a Vietnamese-first AI Calendar Assistant web app that creates Google Calendar events with Google Meet links via natural language conversation.

## Tech Stack
- Framework: Next.js 15+ (App Router), React 19, TypeScript (strict mode)
- Styling: Tailwind CSS v4 / PostCSS, Lucide React
- AI: Vercel AI SDK (`ai`), `@ai-sdk/openai` configured with OpenRouter
- Auth & Session: Google OAuth 2.0, `jose` encrypted JWE HTTP-only cookies
- Calendar: Google Calendar API v3 direct REST calls (`conferenceDataVersion=1`)
- Testing: Vitest, React Testing Library, Playwright

## Durable Project Rules
1. **Mandatory LLM Environment Variables**:
   - `OPENROUTER_API_KEY`: API key for OpenRouter
   - `OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free`: Free OpenRouter model
   - `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`: Endpoint URL
   - Never substitute provider SDKs or hardcode models.
2. **Vietnamese First**:
   - All UI copy, assistant responses, error messages, and prompt hints must be natural, polite Vietnamese.
   - Timezone defaults to `Asia/Ho_Chi_Minh` (GMT+7).
3. **Human-in-the-Loop Confirmation**:
   - Never claim an event was created until Google Calendar API returns success.
   - The AI must call `proposeMeeting` to present a `MeetingPreviewCard`. The actual creation is triggered only by the user clicking the confirmation button (`POST /api/calendar/confirm`).
4. **Security & Secrets**:
   - Google tokens, client secret, and OpenRouter API key must never be sent to the browser or leaked into LLM prompts.
   - Encrypt sessions server-side using AES-256-GCM / JWE via `jose` in HTTP-only cookies.
   - Validate OAuth `state` to prevent CSRF.
5. **No AI Attribution in Commits**:
   - No `Co-Authored-By: Claude` or any AI trailers in commits. Conventional commits only.

## Common Commands
- `npm run dev`: Start Next.js development server
- `npm run build`: Production build
- `npm run lint`: ESLint check
- `npm run typecheck`: TypeScript typecheck
- `npm test`: Run Vitest unit & integration tests

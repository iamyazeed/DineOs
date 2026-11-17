# DineOS — Intelligent Campus Dining Operations

Multi-tenant campus canteen platform (Next.js 16 App Router · TypeScript · Tailwind v4 · Supabase Postgres/Auth/RLS/Storage). Visual design ported from the Stackline prototype (amber/teal glass, Bricolage Grotesque / Inter / JetBrains Mono, dark + light).

## Setup
1. Create a Supabase project.
2. Run the SQL files in `supabase/migrations/` **in order** (SQL editor, or `supabase db push`).
3. For the demo, run `supabase/seed.sql` (creates the demo accounts; it uses `session_replication_role`, so run it as `postgres`).
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; needed only for creating logins)
5. `npm install` then `npm run dev`.

## Demo accounts (sample data). Password: `CampusMeal#2026`
super@ · admin@ · chef@ · teacher1@…teacher5@ · student1@…student3@ — all `@campusmeal.demo`.

## Scripts
`npm run dev | build | lint | typecheck | test`

## Calculation rule (single source of truth)
`src/features/meals/calc.ts` (mirrored by SQL `meal_totals()` for analytics):
regular = eligible − DISTINCT(cancellations ∪ absences) − separate-food students; separate portions are counted separately (approved requests only).

## Deploy (Vercel)
Import the repo, set the root directory to `campusmeal/`, add the 3 environment variables, deploy. In Supabase Auth settings, set the Site URL to the Vercel URL.

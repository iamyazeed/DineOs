# DineOS — Intelligent Campus Dining Operations

Multi-tenant campus canteen platform (Next.js 16 App Router · TypeScript · Tailwind v4 · Supabase Postgres/Auth/RLS/Storage). Visual design follows the KMO Islamic Academy site: cream and evergreen with lime actions, Montserrat / JetBrains Mono, Lucide icons, light + dark.

## Setup
1. Create a Supabase project.
2. Run the SQL files in `supabase/migrations/` **in order** (SQL editor, or `supabase db push`).
3. For the demo, run `supabase/seed.sql`. If you seeded before Nov 2026 and demo logins fail, run `supabase/fix_demo_logins.sql` once (creates the demo accounts; it uses `session_replication_role`, so run it as `postgres`).
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; needed only for creating logins)
5. `npm install` then `npm run dev`.

## Demo data
`supabase/seed.sql` creates **KMO Islamic Academy** (code `KMOIA`) — sample data only.

- 12 classes: S1–S5, SS1, SS2, D1–D3, P1, P2 — 20 students each, named like `Abu - 001`, `Malik - 002` …
- Each class has one letter and its tables are numbered: S1 → A1, A2; S2 → B1, B2; … P2 → L1, L2 (10 seats each).
- S and SS classes eat in the Main Hall; D and P classes in the Annex Hall.

| Role | Sign in with | Password |
| --- | --- | --- |
| Super admin | `test@superadmin` | `123` |
| Institution admin | `test@instadmin` | `123` |
| Chef | `test@chef` | `123` |
| Teacher (class teacher of all 12 classes) | `test@teacher` | `123` |
| Student | `KMOIA001` … `KMOIA240` | `123` |

## Adding people
- **Super admin → Institutions:** add institution admins one at a time or in bulk.
- **Institution admin → Students:** add students one at a time or in bulk, optionally with logins. Student IDs are the institution code plus a 3-digit number (`KMOIA241`).
- **Institution admin → Teachers & staff:** add teachers and chefs one at a time or in bulk.
- Bulk import accepts rows pasted from Excel / Google Sheets or an uploaded CSV, shows a preview, and reports any rows it skipped. Each form has a downloadable template.
- Creating logins needs `SUPABASE_SERVICE_ROLE_KEY`. Supabase's default minimum password length is 6; the demo accounts use `123` because the seed writes them directly.

## Scripts
`npm run dev | build | lint | typecheck | test`

## Calculation rule (single source of truth)
`src/features/meals/calc.ts` (mirrored by SQL `meal_totals()` for analytics):
regular = eligible − DISTINCT(cancellations ∪ absences) − separate-food students; separate portions are counted separately (approved requests only).

## Deploy (Vercel)
Import the repo, set the root directory to `campusmeal/`, add the 3 environment variables, deploy. In Supabase Auth settings, set the Site URL to the Vercel URL.

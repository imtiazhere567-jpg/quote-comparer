# BidLevel (working name)

Owners or contractors list the work for a build. Contractors collect rates from sub-contractors, compare them, award the work (whole job or per item), and send the owner one final quote. Owners never see sub-contractor rates.

## Run it locally (demo mode, no setup)

`npm install` then `npm run dev`. With no database configured the app runs on a local demo
database (PGlite, stored in `~/.bidlevel-demo`) seeded with demo users and two jobs.
Log in by picking a user; no passwords. Delete `~/.bidlevel-demo` to reset the demo data.

## Connect Supabase (production)

1. Create a Supabase project.
2. In the SQL editor, run every file in `supabase/migrations/` in order.
3. Copy `.env.local.example` to `.env.local` and fill in the URL and keys (Project Settings → API), plus
   `DATABASE_URL` (Project Settings → Database → connection string). Demo mode turns off automatically.
4. In Supabase → Authentication → URL Configuration, add `http://localhost:3000/auth/callback` as a redirect URL.
5. `npm install` then `npm run dev`, and open http://localhost:3000.

## Roles

| Role | Access |
|------|--------|
| Owner | Own jobs, scope (while draft), quotes the contractor has sent |
| Contractor | Own jobs, scope, sub-contractors, bids, awards, owner quotes, audit log |
| Sub-contractor | No login. Uses a magic link (`/bid/<token>`), handled server-side |
| Admin | Platform-wide read. Set manually in the database; can't be chosen at sign-up |

Privacy is enforced by Row Level Security in the database, not only in the UI.

## Build progress

- [x] 1. Project setup, roles, auth, database schema
- [x] 2. Job creation and scope editor
- [x] 3. Sub-contractor invites and bid form
- [x] 4. Comparison (whole job and per item) and awards
- [x] 5. Final quote builder and owner view
- [ ] 6. Notifications (email/SMS) and audit history

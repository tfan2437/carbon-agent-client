# TODO

Remaining work to ship Phase 2 (Supabase + Cloud Run integration) to
production. The frontend code itself is complete and passes
`pnpm lint` + `pnpm build`.

## Blocking — before any deploy

### Env / secrets

- [ ] Replace `BACKEND_API_URL` placeholder in `.env.local` with the
      real Cloud Run URL (currently `https://ghg-ingest-<hash>-uc.a.run.app`).
- [ ] Install `google-auth-library` so the `/api/jobs` route can mint
      Google ID tokens:
      ```
      pnpm add google-auth-library
      ```
      (Currently lazy-imported; without it every backend call relies on
      `x-api-token` only and will 401 once the backend enforces IAM.)
- [ ] Grant `roles/run.invoker` on the `ghg-ingest` Cloud Run service
      to `docai-pipeline@stellar-builder-486509-h8.iam.gserviceaccount.com`
      (the SA in `secret/service-account.json`). Confirm with the backend
      team — this SA is shared with the Document AI pipeline.

### Supabase project setup

- [ ] Apply the Phase 2 schema to project `wxntwvcwmargtxsvimuv`:
      tables `projects`, `documents`, `jobs`, `records`,
      `emission_results`, `graphs` + enums `document_status`,
      `job_status`. See `docs/integration.md` + the planning doc in
      `/Users/wei/Desktop/plan/frontend-integration.md` §3.
- [ ] Create private Storage bucket named `ghg`.
- [ ] Enable Realtime on `documents` and `jobs` tables (replication
      publication `supabase_realtime`).
- [ ] RLS: Phase 2 has no auth, so either keep RLS off or add
      permissive policies. Revisit when Phase 4 auth lands.

## Vercel deployment checklist

- [ ] Add env vars in Vercel Project Settings → Environment Variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SUPABASE_BUCKET=ghg`
  - `SUPABASE_SERVICE_ROLE_KEY` (mark Sensitive)
  - `BACKEND_API_URL`
  - `BACKEND_API_TOKEN` (mark Sensitive)
  - `GOOGLE_CREDENTIALS_JSON` — paste the full contents of
    `secret/service-account.json` as a single value (mark Sensitive).
    **Do NOT set** `GOOGLE_APPLICATION_CREDENTIALS` on Vercel.
- [ ] Scope secrets to Production + Preview; leave Development
      unscoped so local `.env.local` wins.
- [ ] Rotate the service-account key if its JSON was pasted anywhere
      non-secret (Slack, PR description, screenshot, etc).

## Hygiene before production

- [ ] Remove `ignoreBuildErrors: true` from `next.config.mjs`
      (inherited from the v0 scaffold). Requires fixing the
      pre-existing `components/ghg-graph.tsx` force-graph generic
      errors first — they're unrelated to Phase 2.
- [ ] Decide: keep `SUPABASE_DB_PASSWORD` in `.env.local` (only needed
      for `psql` / Supabase CLI migrations) or drop it — frontend code
      does not use it.
- [ ] Make `GOOGLE_APPLICATION_CREDENTIALS` an absolute path in
      `.env.local` if the dev server is ever started from a different
      CWD.

## Phase 3 follow-ups (blocked by backend)

- [ ] Wire "View Graph" button on `/projects/[id]` (currently a
      disabled Phase 3 placeholder in
      `components/projects/processing-section.tsx`). Will fetch
      `graphs.graph_json` once available.
- [ ] Swap `/mock-data/graph.json` fetch in `components/ghg-graph.tsx`
      for the live `graphs` table payload (one-line change per
      `docs/integration.md`).

## Pre-existing items (carried from CLAUDE.md)

- [ ] Real evidence file preview — PDF embed for electricity bills,
      SheetJS render for XLSX fuel/refrigerant/work_hours. Today the
      Evidence tab is a placeholder with a disabled download button.
- [ ] Multi-year selector UI — relevant once 2026 data accumulates.
- [ ] Remove the 57 unused shadcn `components/ui/` files in one pass.
- [ ] Remove `lib/ghg-data.ts` once no callers remain.

## Nice-to-have

- [ ] Long-term: replace static SA key with Vercel OIDC →
      GCP Workload Identity Federation. No static secret, rotates
      automatically. Extra one-time setup in GCP IAM.
- [ ] Generate `lib/supabase/types.ts` via `supabase gen types`
      instead of hand-maintaining (once the CLI is wired up).

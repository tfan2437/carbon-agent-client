-- ══════════════════════════════════════════════════
-- LingCarbon GHG — initial schema
-- Single-user mode: RLS disabled. Do not ship to multi-tenant without enabling.
-- ══════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- ── projects ────────────────────────────────────────
create table public.projects (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  company_id      text not null,          -- matches config/companies/{id}.yaml key
  reporting_year  int  not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── documents (uploaded files) ──────────────────────
create type document_status as enum ('uploaded', 'processing', 'processed', 'failed', 'duplicate');

create table public.documents (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  storage_path    text not null,           -- e.g. "ghg/{project_id}/inputs/{document_id}/filename.xlsx"
  filename        text not null,
  content_hash    text,                    -- sha256 hex; null until backend computes it
  doc_type        text,                    -- 'fuel'|'electricity'|'refrigerant'|'work_hours'|null
  file_size_bytes bigint,
  status          document_status not null default 'uploaded',
  warnings        jsonb,                   -- optional; populated on processed/failed
  uploaded_at     timestamptz not null default now(),
  processed_at    timestamptz
);
create index documents_project_idx        on public.documents(project_id);
create index documents_hash_per_project   on public.documents(project_id, content_hash);

-- ── jobs (pipeline runs) ────────────────────────────
create type job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create table public.jobs (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  status          job_status not null default 'queued',
  progress        jsonb,                   -- {"done": 3, "total": 10, "current": "file.pdf"}
  warnings        jsonb,                   -- file-level warnings array
  error           text,                    -- set when status = 'failed'
  document_ids    uuid[] not null,         -- snapshot of documents included in this run
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz
);
create index jobs_project_idx on public.jobs(project_id);
create index jobs_status_idx  on public.jobs(status);

-- ── records (one per DocumentRecord) ────────────────
create table public.records (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  document_id     uuid not null references public.documents(id) on delete cascade,
  source_type     text not null,          -- 'fuel'|'electricity'|'refrigerant'|'work_hours'
  file_hash       text not null,
  period_start    date not null,
  period_end      date not null,
  status          text not null,          -- from ProcessingStatus enum
  record_json     jsonb not null,         -- full DocumentRecord.model_dump()
  created_at      timestamptz not null default now()
);
create index records_project_idx    on public.records(project_id);
create index records_job_idx        on public.records(job_id);
create index records_document_idx   on public.records(document_id);
create index records_hash_project   on public.records(project_id, file_hash);

-- ── emission_results (flattened per-year emission facts) ──
create table public.emission_results (
  id              uuid primary key default uuid_generate_v4(),
  record_id       uuid not null references public.records(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  year            int not null,
  scope           text not null,          -- 'SCOPE_1'|'SCOPE_2'|'SCOPE_3'
  gas             text,                   -- nullable for row-level rollup; specific gas for breakdown rows
  facility_id     text,
  facility_name   text,
  source_code     text,
  activity_value  numeric(18, 4),
  activity_unit   text,
  emissions_kgco2e numeric(18, 4),
  emissions_tco2e numeric(18, 4),
  period_start    date,
  period_end      date,
  created_at      timestamptz not null default now()
);
create index emission_project_year_idx on public.emission_results(project_id, year);
create index emission_record_idx       on public.emission_results(record_id);
create index emission_gas_idx          on public.emission_results(project_id, gas);

-- ── graphs (cached force-graph JSON per project) ────
create table public.graphs (
  project_id      uuid primary key references public.projects(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  graph_json      jsonb not null,          -- {nodes: [...], links: [...]}
  built_at        timestamptz not null default now()
);

-- Demo Purpose Disable RLS
-- ── Realtime ────────────────────────────────────────
-- Enable Realtime on jobs + documents so frontend can subscribe.
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.documents;

-- ── updated_at trigger ──────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- TODO (multi-user phase): add user_id columns, enable RLS, add policies.


-- Tables: disable RLS for demo
ALTER TABLE projects         DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents        DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs             DISABLE ROW LEVEL SECURITY;
ALTER TABLE records          DISABLE ROW LEVEL SECURITY;
ALTER TABLE emission_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE graphs           DISABLE ROW LEVEL SECURITY;

-- Storage: storage.objects RLS cannot be disabled, but we can add a
-- permissive policy scoped to the 'ghg' bucket for anon + authenticated.
CREATE POLICY "demo_ghg_all"
  ON storage.objects
  FOR ALL
  TO anon, authenticated
  USING  (bucket_id = 'ghg')
  WITH CHECK (bucket_id = 'ghg');
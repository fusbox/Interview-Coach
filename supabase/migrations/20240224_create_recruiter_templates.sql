-- Create recruiter_templates table
create table if not exists recruiter_templates (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_shared boolean not null default true,
  target_role text not null,
  questions jsonb not null, -- { star: [], perma: [], technical: [] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for performance
create index if not exists idx_recruiter_templates_recruiter_id on recruiter_templates (recruiter_id);
create index if not exists idx_recruiter_templates_is_shared on recruiter_templates (is_shared);

-- Enable RLS
alter table recruiter_templates enable row level security;

-- Policies
drop policy if exists "recruiter_templates_select" on recruiter_templates;
create policy "recruiter_templates_select" on recruiter_templates 
  for select to authenticated 
  using (recruiter_id = auth.uid() or is_shared = true);

drop policy if exists "recruiter_templates_all_creator" on recruiter_templates;
create policy "recruiter_templates_all_creator" on recruiter_templates 
  for all to authenticated 
  using (recruiter_id = auth.uid());

-- Trigger for updated_at
drop trigger if exists trg_recruiter_templates_updated_at on recruiter_templates;
create trigger trg_recruiter_templates_updated_at
before update on recruiter_templates
for each row execute function set_updated_at();

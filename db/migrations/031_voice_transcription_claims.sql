-- Bind a voice transcription command's user-authorized path to every run.
-- Slice 167 deliberately refuses to infer intent for any pre-existing rows.

alter table public.candidate_voice_transcription_runs
  add column if not exists submission_path text;

alter table public.invited_practice_voice_transcription_runs
  add column if not exists submission_path text;

do $$
begin
  if exists (
    select 1 from public.candidate_voice_transcription_runs where submission_path is null
  ) or exists (
    select 1 from public.invited_practice_voice_transcription_runs where submission_path is null
  ) then
    raise exception 'voice transcription runs must be cleared before applying immutable submission intent';
  end if;
end;
$$;

alter table public.candidate_voice_transcription_runs
  alter column submission_path set not null;

alter table public.invited_practice_voice_transcription_runs
  alter column submission_path set not null;

do $$
begin
  alter table public.candidate_voice_transcription_runs
    add constraint chk_candidate_voice_transcription_submission_path
    check (submission_path in ('quick_submit', 'transcript_review'));
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.invited_practice_voice_transcription_runs
    add constraint chk_invited_voice_transcription_submission_path
    check (submission_path in ('quick_submit', 'transcript_review'));
exception
  when duplicate_object then null;
end;
$$;

create or replace function public.validate_voice_transcription_submission_path_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.submission_path is distinct from old.submission_path then
    raise exception 'voice transcription submission path is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_candidate_voice_transcription_submission_path_immutable
  on public.candidate_voice_transcription_runs;
create trigger trg_candidate_voice_transcription_submission_path_immutable
before update on public.candidate_voice_transcription_runs
for each row execute function public.validate_voice_transcription_submission_path_immutable();

drop trigger if exists trg_invited_voice_transcription_submission_path_immutable
  on public.invited_practice_voice_transcription_runs;
create trigger trg_invited_voice_transcription_submission_path_immutable
before update on public.invited_practice_voice_transcription_runs
for each row execute function public.validate_voice_transcription_submission_path_immutable();

comment on column public.candidate_voice_transcription_runs.submission_path is
  'Immutable user-authorized transcription path: quick_submit or transcript_review.';

comment on column public.invited_practice_voice_transcription_runs.submission_path is
  'Immutable user-authorized transcription path: quick_submit or transcript_review.';

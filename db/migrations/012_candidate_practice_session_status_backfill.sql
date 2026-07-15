-- Repair V2 sessions that accepted answers before answer persistence maintained session status.
-- A round remains in progress until the explicit completion mutation succeeds.

update public.candidate_practice_sessions
set status = 'in_progress'
where status = 'planned'
  and completion_snapshot_json is null
  and coalesce(answer_submissions_json, '{}'::jsonb) <> '{}'::jsonb;

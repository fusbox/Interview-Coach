-- Permit processed document-upload artifacts. Keep later photo artifacts valid when the migration is replayed.
-- Source document and photo bytes remain request-scoped and are never stored.

alter table public.candidate_resume_processed_artifacts
  drop constraint if exists chk_candidate_resume_artifact_source;

alter table public.candidate_resume_processed_artifacts
  add constraint chk_candidate_resume_artifact_source
  check (source in ('pasted_text', 'document_upload', 'photo_capture', 'trusted_host'));

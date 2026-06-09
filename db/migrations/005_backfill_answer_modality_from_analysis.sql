-- Repair answers saved before every candidate submit/recovery path persisted modality canonically.
-- The analysis payload is used only as a one-time source for rows where the answer still has
-- the default text modality but the completed feedback analysis proves audio was used.

update public.answers a
set modality = 'voice'::public.modality_type
from public.eval_results er
where er.session_id = a.session_id
  and er.question_id = a.question_id
  and a.modality = 'text'::public.modality_type
  and er.feedback_json -> 'meta' ->> 'modality' = 'voice';

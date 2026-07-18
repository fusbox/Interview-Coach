-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ai_generations (
  generation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  app_name text NOT NULL,
  surface text NOT NULL CHECK (surface = ANY (ARRAY['question_generation'::text, 'answer_feedback'::text, 'hint'::text, 'strong_response'::text, 'session_debrief'::text])),
  status text NOT NULL CHECK (status = ANY (ARRAY['success'::text, 'failed'::text, 'partial'::text])),
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt_version text NOT NULL,
  model_provider text NOT NULL,
  model_name text NOT NULL,
  model_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_output jsonb,
  parsed_output jsonb,
  latency_ms integer NOT NULL DEFAULT 0,
  token_usage jsonb,
  cost_estimate numeric,
  trace_id text,
  correlation_id text,
  created_by uuid,
  session_id uuid,
  invite_batch_id uuid,
  candidate_id text,
  error_json jsonb,
  privacy_flags ARRAY NOT NULL DEFAULT '{}'::text[],
  redaction_status text NOT NULL CHECK (redaction_status = ANY (ARRAY['raw'::text, 'redacted'::text, 'not_applicable'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  prompt_snapshot jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  retention_class text NOT NULL DEFAULT 'eval_redacted'::text CHECK (retention_class = ANY (ARRAY['eval_redacted'::text, 'eval_raw_restricted'::text, 'operational_debug'::text])),
  retention_until timestamp with time zone,
  CONSTRAINT ai_generations_pkey PRIMARY KEY (generation_id)
);
CREATE TABLE public.answers (
  answer_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  question_id uuid NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  modality USER-DEFINED NOT NULL DEFAULT 'text'::modality_type,
  draft_text text,
  draft_revision integer NOT NULL DEFAULT 0,
  draft_updated_at timestamp with time zone,
  final_text text,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT answers_pkey PRIMARY KEY (answer_id),
  CONSTRAINT answers_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(session_id),
  CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(question_id)
);
CREATE TABLE public.api_idempotency_keys (
  scope text NOT NULL,
  actor_id uuid NOT NULL,
  key_hash text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text])),
  status_code integer,
  response_body jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  CONSTRAINT api_idempotency_keys_pkey PRIMARY KEY (scope, actor_id, key_hash)
);
CREATE TABLE public.candidate_tokens (
  token_id uuid NOT NULL DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  session_id uuid NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT candidate_tokens_pkey PRIMARY KEY (token_id),
  CONSTRAINT candidate_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(session_id)
);
CREATE TABLE public.eval_results (
  eval_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  question_id uuid NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  status USER-DEFINED NOT NULL DEFAULT 'PENDING'::eval_status,
  feedback_json jsonb,
  model_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT eval_results_pkey PRIMARY KEY (eval_id),
  CONSTRAINT eval_results_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(session_id),
  CONSTRAINT eval_results_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(question_id)
);
CREATE TABLE public.events (
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  event_type text NOT NULL,
  actor USER-DEFINED NOT NULL,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  correlation_id uuid,
  event_version integer NOT NULL DEFAULT 1,
  schema_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (event_id),
  CONSTRAINT events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(session_id)
);
CREATE TABLE public.invite_batch_candidates (
  batch_candidate_id uuid NOT NULL DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  candidate_index integer NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  req_id text NOT NULL,
  resume_text text,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'created'::text, 'failed'::text, 'retry_issued'::text])),
  retryable boolean NOT NULL DEFAULT true,
  retry_count integer NOT NULL DEFAULT 0,
  session_id uuid,
  error_code text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT invite_batch_candidates_pkey PRIMARY KEY (batch_candidate_id),
  CONSTRAINT invite_batch_candidates_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.invite_batches(batch_id)
);
CREATE TABLE public.invite_batches (
  batch_id uuid NOT NULL,
  parent_batch_id uuid,
  last_retry_batch_id uuid,
  created_by uuid NOT NULL,
  role text NOT NULL,
  job_description text,
  questions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'retry_issued'::text])),
  requested_count integer NOT NULL DEFAULT 0,
  succeeded_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT invite_batches_pkey PRIMARY KEY (batch_id),
  CONSTRAINT invite_batches_parent_batch_id_fkey FOREIGN KEY (parent_batch_id) REFERENCES public.invite_batches(batch_id),
  CONSTRAINT invite_batches_last_retry_batch_id_fkey FOREIGN KEY (last_retry_batch_id) REFERENCES public.invite_batches(batch_id)
);
CREATE TABLE public.metric_counter_rollups (
  bucket_start timestamp with time zone NOT NULL,
  metric_name text NOT NULL,
  tags_key text NOT NULL,
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  value bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT metric_counter_rollups_pkey PRIMARY KEY (bucket_start, metric_name, tags_key)
);
CREATE TABLE public.metric_timing_rollups (
  bucket_start timestamp with time zone NOT NULL,
  metric_name text NOT NULL,
  tags_key text NOT NULL,
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  count bigint NOT NULL DEFAULT 0,
  total_ms bigint NOT NULL DEFAULT 0,
  min_ms integer NOT NULL DEFAULT 0,
  max_ms integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT metric_timing_rollups_pkey PRIMARY KEY (bucket_start, metric_name, tags_key)
);
CREATE TABLE public.projection_session_now (
  session_id uuid NOT NULL,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT projection_session_now_pkey PRIMARY KEY (session_id),
  CONSTRAINT projection_session_now_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(session_id)
);
CREATE TABLE public.questions (
  question_id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  question_index integer NOT NULL CHECK (question_index >= 0),
  question_text text NOT NULL,
  competencies jsonb,
  scoring_dimensions jsonb,
  tts_state USER-DEFINED NOT NULL DEFAULT 'NONE'::tts_status,
  tts_audio_ref text,
  tts_generated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  category text DEFAULT 'General'::text,
  CONSTRAINT questions_pkey PRIMARY KEY (question_id),
  CONSTRAINT questions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(session_id)
);
CREATE TABLE public.rate_limit_buckets (
  bucket_key text NOT NULL,
  count integer NOT NULL CHECK (count >= 0),
  reset_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (bucket_key)
);
CREATE TABLE public.recruiter_profiles (
  recruiter_id uuid NOT NULL,
  first_name text,
  last_name text,
  phone text,
  timezone text DEFAULT 'UTC'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  CONSTRAINT recruiter_profiles_pkey PRIMARY KEY (recruiter_id),
  CONSTRAINT recruiter_profiles_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES auth.users(id)
);
CREATE TABLE public.recruiter_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  name text NOT NULL,
  is_shared boolean NOT NULL DEFAULT true,
  target_role text NOT NULL,
  questions jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recruiter_templates_pkey PRIMARY KEY (id),
  CONSTRAINT recruiter_templates_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES auth.users(id)
);
CREATE TABLE public.sessions (
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  recruiter_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'NOT_STARTED'::session_status,
  current_question_index integer NOT NULL DEFAULT 0,
  target_role text,
  job_description text,
  intake_json jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  parent_session_id uuid,
  attempt_number integer DEFAULT 1,
  client_name text,
  readiness_band USER-DEFINED,
  summary_narrative text,
  invitation_sent_at timestamp with time zone,
  CONSTRAINT sessions_pkey PRIMARY KEY (session_id),
  CONSTRAINT sessions_parent_session_id_fkey FOREIGN KEY (parent_session_id) REFERENCES public.sessions(session_id)
);
CREATE TABLE public.user_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  recruiter_id uuid,
  type text NOT NULL,
  rating integer,
  comment text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT user_feedback_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(session_id),
  CONSTRAINT user_feedback_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES auth.users(id)
);
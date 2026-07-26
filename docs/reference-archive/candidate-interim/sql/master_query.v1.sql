with params as (
  select
    null::text as candidate_email_filter,
    null::uuid as session_id_filter,
    null::uuid as practice_draft_id_filter
),
candidate_flows as (
  select
    cp.candidate_profile_id,
    cp.auth_subject as candidate_key,
    cp.email as candidate_email,
    cp.display_name as candidate_display_name,
    cp.workspace,
    cp.status as candidate_status,
    d.practice_draft_id,
    d.role_profile_id,
    d.session_id,
    d.status as draft_status,
    d.target_role,
    d.job_description,
    d.resume_context_json,
    d.custom_questions_json,
    d.intake_responses_json,
    d.question_set_snapshot_id,
    d.resume_target_screen,
    d.generation_started_at,
    d.generation_finished_at,
    d.generation_error,
    d.last_activity_at,
    d.created_at as draft_created_at,
    d.updated_at as draft_updated_at,
    rp.target_role as role_profile_target_role,
    rp.normalized_target_role,
    rp.job_description_snapshot,
    rp.job_description_hash,
    rp.resume_context_snapshot_json,
    rp.source as role_profile_source,
    rp.status as role_profile_status,
    s.status as session_status,
    s.current_question_index,
    s.target_role as session_target_role,
    s.job_description as session_job_description,
    s.intake_json,
    s.client_name,
    s.readiness_band,
    s.summary_narrative,
    s.created_at as session_created_at,
    s.updated_at as session_updated_at,
    ids.identities_json
  from candidate_practice_drafts d
  join candidate_profiles cp
    on cp.candidate_profile_id = d.candidate_profile_id
  left join candidate_role_preparation_profiles rp
    on rp.role_profile_id = d.role_profile_id
  left join sessions s
    on s.session_id = d.session_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'provider', ci.provider,
        'issuer', ci.issuer,
        'subject', ci.subject,
        'email', ci.email,
        'lastSeenAt', ci.last_seen_at,
        'createdAt', ci.created_at,
        'updatedAt', ci.updated_at
      )
      order by coalesce(ci.last_seen_at, ci.updated_at, ci.created_at) desc
    ) as identities_json
    from candidate_identities ci
    where ci.candidate_profile_id = cp.candidate_profile_id
  ) ids on true
  cross join params p
  where (p.candidate_email_filter is null or lower(cp.email) = lower(p.candidate_email_filter))
    and (p.session_id_filter is null or d.session_id = p.session_id_filter)
    and (p.practice_draft_id_filter is null or d.practice_draft_id = p.practice_draft_id_filter)
)
select
  cf.candidate_key,
  cf.candidate_email,
  cf.candidate_display_name,
  cf.target_role,
  cf.practice_draft_id,
  cf.session_id,
  cf.draft_status,
  cf.session_status,
  coalesce(cf.draft_created_at, cf.session_created_at) as flow_started_at,
  coalesce(cf.last_activity_at, cf.session_updated_at, cf.draft_updated_at) as flow_last_updated_at,
  jsonb_build_object(
    'candidate', jsonb_build_object(
      'candidateProfileId', cf.candidate_profile_id,
      'candidateKey', cf.candidate_key,
      'email', cf.candidate_email,
      'displayName', cf.candidate_display_name,
      'workspace', cf.workspace,
      'status', cf.candidate_status,
      'identities', coalesce(cf.identities_json, '[]'::jsonb)
    ),
    'practiceSetup', jsonb_build_object(
      'practiceDraftId', cf.practice_draft_id,
      'draftStatus', cf.draft_status,
      'targetRole', cf.target_role,
      'jobDescription', cf.job_description,
      'resumeContext', cf.resume_context_json,
      'customQuestions', cf.custom_questions_json,
      'intakeResponses', cf.intake_responses_json,
      'questionSetSnapshotId', cf.question_set_snapshot_id,
      'resumeTargetScreen', cf.resume_target_screen,
      'generationStartedAt', cf.generation_started_at,
      'generationFinishedAt', cf.generation_finished_at,
      'generationError', cf.generation_error,
      'createdAt', cf.draft_created_at,
      'updatedAt', cf.draft_updated_at,
      'lastActivityAt', cf.last_activity_at
    ),
    'rolePreparationProfile', jsonb_build_object(
      'roleProfileId', cf.role_profile_id,
      'targetRole', cf.role_profile_target_role,
      'normalizedTargetRole', cf.normalized_target_role,
      'jobDescriptionSnapshot', cf.job_description_snapshot,
      'jobDescriptionHash', cf.job_description_hash,
      'resumeContextSnapshot', cf.resume_context_snapshot_json,
      'source', cf.role_profile_source,
      'status', cf.role_profile_status
    ),
    'session', jsonb_build_object(
      'sessionId', cf.session_id,
      'status', cf.session_status,
      'currentQuestionIndex', cf.current_question_index,
      'targetRole', cf.session_target_role,
      'jobDescription', cf.session_job_description,
      'intakeData', cf.intake_json,
      'clientName', cf.client_name,
      'readinessBand', cf.readiness_band,
      'engagedTimeSeconds', nullif(cf.intake_json ->> 'engaged_time_seconds', '')::int,
      'createdAt', cf.session_created_at,
      'updatedAt', cf.session_updated_at
    ),
    'questionGenerationAi', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'aiGenerationId', ag.generation_id,
          'surface', ag.surface,
          'status', ag.status,
          'correlationId', ag.correlation_id,
          'traceId', ag.trace_id,
          'createdAt', ag.created_at,
          'modelProvider', ag.model_provider,
          'modelName', ag.model_name,
          'modelParams', ag.model_params,
          'promptVersion', ag.prompt_version,
          'inputSnapshot', ag.input_snapshot,
          'contextArtifacts', ag.context_artifacts,
          'promptSnapshot', ag.prompt_snapshot,
          'rawOutput', ag.raw_output,
          'parsedOutput', ag.parsed_output,
          'tokenUsage', ag.token_usage,
          'latencyMs', ag.latency_ms,
          'privacyFlags', ag.privacy_flags,
          'redactionStatus', ag.redaction_status,
          'sourceRefs', ag.source_refs,
          'errorJson', ag.error_json
        )
        order by ag.created_at
      )
      from ai_generations ag
      where ag.surface = 'question_generation'
        and (
          ag.correlation_id = cf.question_set_snapshot_id::text
          or ag.candidate_id = cf.candidate_profile_id::text
          or ag.session_id = cf.session_id
        )
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question', jsonb_build_object(
            'questionId', q.question_id,
            'questionIndex', q.question_index,
            'questionText', q.question_text,
            'categoryRaw', q.category,
            'categoryChip', q.category,
            'competencies', q.competencies,
            'scoringDimensions', q.scoring_dimensions,
            'ttsState', q.tts_state,
            'ttsAudioRefPresent', q.tts_audio_ref is not null,
            'ttsGeneratedAt', q.tts_generated_at,
            'createdAt', q.created_at,
            'createdAt', q.created_at
          ),
          'hintsAi', coalesce((
            select jsonb_agg(jsonb_build_object(
              'aiGenerationId', ag.generation_id,
              'createdAt', ag.created_at,
              'inputSnapshot', ag.input_snapshot,
              'parsedOutput', ag.parsed_output,
              'rawOutput', ag.raw_output,
              'promptSnapshot', ag.prompt_snapshot,
              'tokenUsage', ag.token_usage,
              'latencyMs', ag.latency_ms,
              'privacyFlags', ag.privacy_flags,
              'sourceRefs', ag.source_refs,
              'errorJson', ag.error_json
            ) order by ag.created_at)
            from ai_generations ag
            where ag.session_id = q.session_id
              and ag.surface = 'hint'
              and (
                exists (
                  select 1
                  from jsonb_array_elements(coalesce(ag.source_refs, '[]'::jsonb)) ref
                  where ref ->> 'type' = 'question'
                    and ref ->> 'questionId' = q.question_id::text
                )
                or ag.input_snapshot ->> 'questionText' = q.question_text
              )
          ), '[]'::jsonb),
          'strongResponseAi', coalesce((
            select jsonb_agg(jsonb_build_object(
              'aiGenerationId', ag.generation_id,
              'createdAt', ag.created_at,
              'inputSnapshot', ag.input_snapshot,
              'parsedOutput', ag.parsed_output,
              'rawOutput', ag.raw_output,
              'promptSnapshot', ag.prompt_snapshot,
              'tokenUsage', ag.token_usage,
              'latencyMs', ag.latency_ms,
              'privacyFlags', ag.privacy_flags,
              'sourceRefs', ag.source_refs,
              'errorJson', ag.error_json
            ) order by ag.created_at)
            from ai_generations ag
            where ag.session_id = q.session_id
              and ag.surface = 'strong_response'
              and (
                exists (
                  select 1
                  from jsonb_array_elements(coalesce(ag.source_refs, '[]'::jsonb)) ref
                  where ref ->> 'type' = 'question'
                    and ref ->> 'questionId' = q.question_id::text
                )
                or ag.input_snapshot ->> 'questionText' = q.question_text
              )
          ), '[]'::jsonb),
          'answerAttempts', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'answerId', a.answer_id,
                'attemptNumber', a.attempt_number,
                'submissionMode', a.modality,
                'draftText', a.draft_text,
                'finalTranscript', a.final_text,
                'submittedAt', a.submitted_at,
                'createdAt', a.created_at,
                'updatedAt', a.updated_at,
                'evaluation', jsonb_build_object(
                  'evalResultId', er.eval_id,
                  'status', er.status,
                  'attemptNumber', er.attempt_number,
                  'modelMetadata', er.model_metadata,
                  'feedbackJson', er.feedback_json,
                  'ack', er.feedback_json -> 'ack',
                  'feedbackPlan', er.feedback_json -> 'feedbackPlan',
                  'scores', er.feedback_json -> 'scores',
                  'contentPulse', er.feedback_json -> 'contentPulse',
                  'deliveryPulse', er.feedback_json -> 'deliveryPulse',
                  'oneBigUpgrade', er.feedback_json -> 'oneBigUpgrade',
                  'nextAction', er.feedback_json -> 'nextAction',
                  'recommendation', er.feedback_json -> 'recommendation',
                  'meta', er.feedback_json -> 'meta',
                  'primaryButtonAfterFeedback', case
                    when er.feedback_json #>> '{nextAction,actionType}' = 'redo_answer' then 'Retry My Answer'
                    when er.feedback_json #>> '{nextAction,actionType}' = 'stop_for_now' then 'Finish Session'
                    when q.question_index + 1 >= qc.question_count then 'Finish Session'
                    when er.feedback_json #>> '{nextAction,actionType}' = 'next_question' then 'Continue to Next Question'
                    else null
                  end,
                  'createdAt', er.created_at,
                  'updatedAt', er.updated_at
                ),
                'answerFeedbackAi', coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'aiGenerationId', ag.generation_id,
                    'createdAt', ag.created_at,
                    'inputSnapshot', ag.input_snapshot,
                    'contextArtifacts', ag.context_artifacts,
                    'promptSnapshot', ag.prompt_snapshot,
                    'parsedOutput', ag.parsed_output,
                    'rawOutput', ag.raw_output,
                    'tokenUsage', ag.token_usage,
                    'latencyMs', ag.latency_ms,
                    'privacyFlags', ag.privacy_flags,
                    'redactionStatus', ag.redaction_status,
                    'sourceRefs', ag.source_refs,
                    'errorJson', ag.error_json
                  ) order by ag.created_at)
                  from ai_generations ag
                  where ag.session_id = q.session_id
                    and ag.surface = 'answer_feedback'
                    and exists (
                      select 1
                      from jsonb_array_elements(coalesce(ag.source_refs, '[]'::jsonb)) ref
                      where ref ->> 'type' = 'question'
                        and ref ->> 'questionId' = q.question_id::text
                    )
                ), '[]'::jsonb)
              )
              order by a.attempt_number
            )
            from answers a
            left join eval_results er
              on er.session_id = a.session_id
             and er.question_id = a.question_id
             and er.attempt_number = a.attempt_number
            where a.question_id = q.question_id
          ), '[]'::jsonb)
        )
        order by q.question_index
      )
      from questions q
      left join lateral (
        select count(*)::int as question_count
        from questions q2
        where q2.session_id = q.session_id
      ) qc on true
      where q.session_id = cf.session_id
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'summaryNarrative', cf.summary_narrative,
      'debriefAi', coalesce((
        select jsonb_agg(jsonb_build_object(
          'aiGenerationId', ag.generation_id,
          'createdAt', ag.created_at,
          'inputSnapshot', ag.input_snapshot,
          'contextArtifacts', ag.context_artifacts,
          'promptSnapshot', ag.prompt_snapshot,
          'parsedOutput', ag.parsed_output,
          'rawOutput', ag.raw_output,
          'tokenUsage', ag.token_usage,
          'latencyMs', ag.latency_ms,
          'privacyFlags', ag.privacy_flags,
          'redactionStatus', ag.redaction_status,
          'sourceRefs', ag.source_refs,
          'errorJson', ag.error_json
        ) order by ag.created_at)
        from ai_generations ag
        where ag.session_id = cf.session_id
          and ag.surface = 'session_debrief'
      ), '[]'::jsonb)
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventId', e.event_id,
        'eventType', e.event_type,
        'actor', e.actor,
        'occurredAt', e.occurred_at,
        'payload', e.payload,
        'correlationId', e.correlation_id,
        'idempotencyKey', e.idempotency_key
      ) order by e.occurred_at)
      from events e
      where e.session_id = cf.session_id
    ), '[]'::jsonb),
    'candidateUserFeedback', coalesce((
      select jsonb_agg(to_jsonb(uf) order by uf.created_at)
      from user_feedback uf
      where uf.session_id = cf.session_id
    ), '[]'::jsonb),
    'allSessionAiGenerations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'aiGenerationId', ag.generation_id,
        'surface', ag.surface,
        'status', ag.status,
        'createdAt', ag.created_at,
        'correlationId', ag.correlation_id,
        'traceId', ag.trace_id,
        'sessionId', ag.session_id,
        'candidateId', ag.candidate_id,
        'createdBy', ag.created_by,
        'inputSnapshot', ag.input_snapshot,
        'contextArtifacts', ag.context_artifacts,
        'parsedOutput', ag.parsed_output,
        'privacyFlags', ag.privacy_flags,
        'redactionStatus', ag.redaction_status,
        'sourceRefs', ag.source_refs,
        'errorJson', ag.error_json
      ) order by ag.created_at)
      from ai_generations ag
      where ag.session_id = cf.session_id
         or ag.correlation_id = cf.question_set_snapshot_id::text
    ), '[]'::jsonb)
  ) as flow_json
from candidate_flows cf
order by
  cf.candidate_email,
  coalesce(cf.last_activity_at, cf.session_updated_at, cf.draft_updated_at, cf.draft_created_at) desc;
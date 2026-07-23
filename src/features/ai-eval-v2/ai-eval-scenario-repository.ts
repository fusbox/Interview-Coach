import {
    AI_EVAL_SCENARIO_OUTPUT_LAYERS,
    AI_EVAL_SCENARIO_BASELINE_VERSION_NUMBER,
    createAiEvalScenarioFingerprint,
    createAiEvalScenarioRunRequestFingerprint,
    getAiEvalScenarioCoverage,
    parseAiEvalScenario,
    type AiEvalScenario,
    type AiEvalScenarioAssertionResult,
    type AiEvalScenarioOutputLayer,
    type AiEvalScenarioRunState,
} from "./ai-eval-scenario-contract";
import { aiEvalScenarioBaselineManifest } from "./ai-eval-scenario-baseline";
import {
    AI_EVAL_LIVE_GATE_VERSION,
    createAiEvalLiveCostPreviewFingerprint,
    parseAiEvalLiveCostPreview,
    type AiEvalLiveCostPreview,
} from "./ai-eval-live-run-contract";

export type AiEvalScenarioQueryClient = {
    query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type AiEvalScenarioDraft = {
    draftId: string;
    ownerOperatorUserId: string;
    creationRequestKey: string;
    scenario: AiEvalScenario;
    lifecycleState: "active" | "archived";
    revision: number;
    createdAt: string;
    updatedAt: string;
};

export type AiEvalScenarioVersion = {
    scenarioVersionId: string;
    sourceDraftId: string | null;
    sourceKind: "baseline" | "operator";
    scenario: AiEvalScenario;
    versionNumber: number;
    inputFingerprint: string;
    stagedAt: string;
};

export type AiEvalScenarioRunSummary = {
    runId: string;
    executionMode: "contract_fixture" | "credentialed_live" | "same_profile_regression";
    lifecycleState: AiEvalScenarioRunState;
    profileId: string;
    configurationFingerprint: string;
    costPreview: AiEvalLiveCostPreview | null;
    caseCount: number;
    completedCaseCount: number;
    failedCaseCount: number;
    assertionResult: AiEvalScenarioAssertionResult | null;
    requestedAt: string;
    completedAt: string | null;
    retentionExpiresAt: string;
};

export type AiEvalScenarioLiveOperation = {
    liveOperationId: string;
    runId: string;
    operationKey: string;
    operationKind: "answer_evaluation" | "coach_update";
    inputFingerprint: string;
    profileId: string;
    configurationFingerprint: string;
    lifecycleState: "queued" | "running" | "completed" | "failed";
    attemptCount: number;
    retryable: boolean;
    nextAttemptAt: string | null;
    claimWorkerId: string | null;
    claimGeneration: number;
    acceptedOutput: Record<string, unknown> | null;
    failure: Record<string, unknown> | null;
};

export type AiEvalScenarioRunLayer = {
    runLayerId: string;
    outputLayer: AiEvalScenarioOutputLayer;
    lifecycleState: "queued" | "running" | "completed" | "failed";
    assertionResult: AiEvalScenarioAssertionResult | null;
    assertionReasons: string[];
    candidateVisible: boolean;
    output: Record<string, unknown> | null;
    diagnostics: Record<string, unknown> | null;
    errorCode: string | null;
};

export type AiEvalScenarioRunCase = {
    runCaseId: string;
    scenarioVersionId: string;
    scenario: AiEvalScenario;
    inputFingerprint: string;
    ordinal: number;
    lifecycleState: "queued" | "running" | "completed" | "failed";
    assertionResult: AiEvalScenarioAssertionResult | null;
    assertionReasons: string[];
    errorCode: string | null;
    layers: AiEvalScenarioRunLayer[];
};

export type AiEvalScenarioRunDetail = AiEvalScenarioRunSummary & {
    cases: AiEvalScenarioRunCase[];
};

export function createAiEvalScenarioRepository(client: AiEvalScenarioQueryClient) {
    return {
        async synchronizeBaseline(operatorUserId: string) {
            const existingSuite = await client.query(`
                select
                  suite.ai_eval_scenario_suite_version_id,
                  suite.manifest_fingerprint,
                  count(member.ai_eval_scenario_suite_member_id)::integer as member_count
                from public.ai_eval_scenario_suite_versions suite
                left join public.ai_eval_scenario_suite_members member
                  on member.ai_eval_scenario_suite_version_id = suite.ai_eval_scenario_suite_version_id
                where suite.suite_key = $1
                  and suite.suite_version = $2
                group by suite.ai_eval_scenario_suite_version_id, suite.manifest_fingerprint
                limit 1
            `, [aiEvalScenarioBaselineManifest.suiteKey, aiEvalScenarioBaselineManifest.suiteVersion]);
            if (existingSuite.rows[0]) {
                const suiteId = readString(existingSuite.rows[0].ai_eval_scenario_suite_version_id);
                const manifestFingerprint = readString(existingSuite.rows[0].manifest_fingerprint);
                const memberCount = readNumber(existingSuite.rows[0].member_count);
                if (
                    manifestFingerprint !== aiEvalScenarioBaselineManifest.manifestFingerprint
                    || memberCount !== aiEvalScenarioBaselineManifest.members.length
                ) throw new Error("Baseline scenario suite manifest drift.");
                return { suiteId, scenarioCount: memberCount };
            }

            for (const member of aiEvalScenarioBaselineManifest.members) {
                const scenario = member.scenario;
                await client.query(`
                    insert into public.ai_eval_scenario_versions (
                      staged_by_operator_user_id,
                      source_kind,
                      scenario_key,
                      scenario_kind,
                      title,
                      version_number,
                      input_fingerprint,
                      scenario_payload_json,
                      coverage_json
                    ) values ($1, 'baseline', $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
                    on conflict (source_kind, scenario_key, version_number) do nothing
                `, [
                    operatorUserId,
                    scenario.scenarioKey,
                    scenario.kind,
                    scenario.title,
                    AI_EVAL_SCENARIO_BASELINE_VERSION_NUMBER,
                    member.inputFingerprint,
                    scenario,
                    getAiEvalScenarioCoverage([scenario]),
                ]);
            }

            const versionRows = await client.query(`
                select ai_eval_scenario_version_id, scenario_key, input_fingerprint
                from public.ai_eval_scenario_versions
                where source_kind = 'baseline'
                  and version_number = $2
                  and scenario_key = any($1::text[])
            `, [
                aiEvalScenarioBaselineManifest.members.map((member) => member.scenarioKey),
                AI_EVAL_SCENARIO_BASELINE_VERSION_NUMBER,
            ]);
            const versions = new Map(versionRows.rows.map((row) => [readString(row.scenario_key), {
                id: readString(row.ai_eval_scenario_version_id),
                fingerprint: readString(row.input_fingerprint),
            }]));
            for (const member of aiEvalScenarioBaselineManifest.members) {
                if (versions.get(member.scenarioKey)?.fingerprint !== member.inputFingerprint) {
                    throw new Error(`Baseline scenario version drift: ${member.scenarioKey}`);
                }
            }

            await client.query(`
                insert into public.ai_eval_scenario_suite_versions (
                  suite_key,
                  suite_version,
                  title,
                  source_kind,
                  manifest_fingerprint,
                  created_by_operator_user_id
                ) values ($1, $2, $3, 'baseline', $4, $5)
                on conflict (suite_key, suite_version) do nothing
            `, [
                aiEvalScenarioBaselineManifest.suiteKey,
                aiEvalScenarioBaselineManifest.suiteVersion,
                aiEvalScenarioBaselineManifest.title,
                aiEvalScenarioBaselineManifest.manifestFingerprint,
                operatorUserId,
            ]);
            const suite = await client.query(`
                select ai_eval_scenario_suite_version_id, manifest_fingerprint
                from public.ai_eval_scenario_suite_versions
                where suite_key = $1 and suite_version = $2
                limit 1
            `, [aiEvalScenarioBaselineManifest.suiteKey, aiEvalScenarioBaselineManifest.suiteVersion]);
            const suiteId = readString(suite.rows[0]?.ai_eval_scenario_suite_version_id);
            if (
                !suiteId
                || readString(suite.rows[0]?.manifest_fingerprint) !== aiEvalScenarioBaselineManifest.manifestFingerprint
            ) throw new Error("Baseline scenario suite manifest drift.");

            for (const member of aiEvalScenarioBaselineManifest.members) {
                const versionId = versions.get(member.scenarioKey)?.id;
                if (!versionId) throw new Error(`Missing baseline scenario version: ${member.scenarioKey}`);
                await client.query(`
                    insert into public.ai_eval_scenario_suite_members (
                      ai_eval_scenario_suite_version_id,
                      ai_eval_scenario_version_id,
                      ordinal
                    ) values ($1, $2, $3)
                    on conflict (ai_eval_scenario_suite_version_id, ai_eval_scenario_version_id) do nothing
                `, [suiteId, versionId, member.ordinal]);
            }
            return { suiteId, scenarioCount: versions.size };
        },

        async listScenarioVersions(operatorUserId: string): Promise<AiEvalScenarioVersion[]> {
            const result = await client.query(`
                select
                  ai_eval_scenario_version_id,
                  source_draft_id,
                  source_kind,
                  version_number,
                  input_fingerprint,
                  scenario_payload_json,
                  to_char(staged_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as staged_at
                from public.ai_eval_scenario_versions
                where source_kind = 'baseline'
                   or staged_by_operator_user_id = $1
                order by source_kind, scenario_key, version_number desc
            `, [operatorUserId]);
            return result.rows.flatMap((row) => {
                const mapped = mapScenarioVersion(row);
                return mapped ? [mapped] : [];
            });
        },

        async listDrafts(operatorUserId: string): Promise<AiEvalScenarioDraft[]> {
            const result = await client.query(`
                select
                  ai_eval_scenario_draft_id,
                  owner_operator_user_id,
                  creation_request_key,
                  scenario_payload_json,
                  lifecycle_state,
                  revision,
                  to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
                  to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at
                from public.ai_eval_scenario_drafts
                where owner_operator_user_id = $1
                order by updated_at desc
            `, [operatorUserId]);
            return result.rows.flatMap((row) => {
                const mapped = mapScenarioDraft(row);
                return mapped ? [mapped] : [];
            });
        },

        async findDraft(operatorUserId: string, draftId: string) {
            const result = await client.query(`
                select
                  ai_eval_scenario_draft_id,
                  owner_operator_user_id,
                  creation_request_key,
                  scenario_payload_json,
                  lifecycle_state,
                  revision,
                  to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at,
                  to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at
                from public.ai_eval_scenario_drafts
                where ai_eval_scenario_draft_id = $1
                  and owner_operator_user_id = $2
                limit 1
            `, [draftId, operatorUserId]);
            return mapScenarioDraft(result.rows[0]);
        },

        async createDraft(input: {
            operatorUserId: string;
            creationRequestKey: string;
            scenario: AiEvalScenario;
        }) {
            const scenario = parseAiEvalScenario(input.scenario);
            const result = await client.query(`
                with inserted as (
                  insert into public.ai_eval_scenario_drafts (
                    owner_operator_user_id,
                    creation_request_key,
                    scenario_key,
                    scenario_kind,
                    title,
                    scenario_payload_json,
                    coverage_json
                  ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
                  on conflict (owner_operator_user_id, creation_request_key) do nothing
                  returning *, 'created'::text as write_outcome
                )
                select * from inserted
                union all
                select existing.*,
                  case when existing.scenario_payload_json = $6::jsonb
                    then 'replayed'::text else 'idempotency_conflict'::text end as write_outcome
                from public.ai_eval_scenario_drafts existing
                where existing.owner_operator_user_id = $1
                  and existing.creation_request_key = $2
                  and not exists (select 1 from inserted)
                limit 1
            `, [
                input.operatorUserId,
                input.creationRequestKey,
                scenario.scenarioKey,
                scenario.kind,
                scenario.title,
                scenario,
                getAiEvalScenarioCoverage([scenario]),
            ]);
            return {
                outcome: readString(result.rows[0]?.write_outcome) as "created" | "replayed" | "idempotency_conflict",
                draft: mapScenarioDraft(result.rows[0]),
            };
        },

        async updateDraft(input: {
            operatorUserId: string;
            draftId: string;
            expectedRevision: number;
            scenario: AiEvalScenario;
        }) {
            const scenario = parseAiEvalScenario(input.scenario);
            const result = await client.query(`
                update public.ai_eval_scenario_drafts
                set title = $4,
                    scenario_payload_json = $5::jsonb,
                    coverage_json = $6::jsonb,
                    revision = revision + 1
                where ai_eval_scenario_draft_id = $1
                  and owner_operator_user_id = $2
                  and revision = $3
                  and lifecycle_state = 'active'
                  and scenario_key = $7
                  and scenario_kind = $8
                returning *
            `, [
                input.draftId,
                input.operatorUserId,
                input.expectedRevision,
                scenario.title,
                scenario,
                getAiEvalScenarioCoverage([scenario]),
                scenario.scenarioKey,
                scenario.kind,
            ]);
            return mapScenarioDraft(result.rows[0]);
        },

        async stageDraft(input: {
            operatorUserId: string;
            draftId: string;
            expectedRevision: number;
            inputFingerprint: string;
        }) {
            const result = await client.query(`
                insert into public.ai_eval_scenario_versions (
                  source_draft_id,
                  source_draft_revision,
                  staged_by_operator_user_id,
                  source_kind,
                  scenario_key,
                  scenario_kind,
                  title,
                  version_number,
                  input_fingerprint,
                  scenario_payload_json,
                  coverage_json
                )
                select
                  draft.ai_eval_scenario_draft_id,
                  draft.revision,
                  $2,
                  'operator',
                  draft.scenario_key,
                  draft.scenario_kind,
                  draft.title,
                  coalesce((
                    select max(version.version_number)
                    from public.ai_eval_scenario_versions version
                    where version.source_kind = 'operator'
                      and version.scenario_key = draft.scenario_key
                  ), 0) + 1,
                  $4,
                  draft.scenario_payload_json,
                  draft.coverage_json
                from public.ai_eval_scenario_drafts draft
                where draft.ai_eval_scenario_draft_id = $1
                  and draft.owner_operator_user_id = $2
                  and draft.revision = $3
                  and draft.lifecycle_state = 'active'
                on conflict (source_draft_id, source_draft_revision)
                  where source_draft_id is not null
                  do nothing
                returning *
            `, [input.draftId, input.operatorUserId, input.expectedRevision, input.inputFingerprint]);
            const inserted = mapScenarioVersion(result.rows[0]);
            if (inserted) return inserted;
            const existing = await client.query(`
                select *
                from public.ai_eval_scenario_versions
                where source_draft_id = $1
                  and source_draft_revision = $2
                  and staged_by_operator_user_id = $3
                limit 1
            `, [input.draftId, input.expectedRevision, input.operatorUserId]);
            return mapScenarioVersion(existing.rows[0]);
        },

        async submitRun(input: {
            operatorUserId: string;
            creationRequestKey: string;
            suiteVersionId: string | null;
            scenarioVersions: AiEvalScenarioVersion[];
            profileId: string;
            configurationFingerprint: string;
        }) {
            const scenarioVersionIds = input.scenarioVersions.map((version) => version.scenarioVersionId);
            const requestFingerprint = createAiEvalScenarioRunRequestFingerprint({
                executionMode: "contract_fixture",
                suiteVersionId: input.suiteVersionId,
                scenarioVersionIds,
                profileId: input.profileId,
                configurationFingerprint: input.configurationFingerprint,
            });
            const result = await client.query(`
                select *
                from public.create_ai_eval_scenario_run_request(
                  $1, $2, $3, 'contract_fixture', $4, $5, $6, $7::uuid[]
                )
            `, [
                input.operatorUserId,
                input.creationRequestKey,
                requestFingerprint,
                input.suiteVersionId,
                input.profileId,
                input.configurationFingerprint,
                scenarioVersionIds,
            ]);
            return {
                outcome: readString(result.rows[0]?.outcome) as "created" | "replayed" | "idempotency_conflict",
                runId: readString(result.rows[0]?.ai_eval_scenario_run_id),
                requestFingerprint,
            };
        },

        async submitLiveRun(input: {
            operatorUserId: string;
            creationRequestKey: string;
            suiteVersionId: string | null;
            scenarioVersions: AiEvalScenarioVersion[];
            profileId: string;
            configurationFingerprint: string;
            costPreview: AiEvalLiveCostPreview;
        }) {
            const costPreview = parseAiEvalLiveCostPreview(input.costPreview);
            if (!costPreview || !costPreview.withinLimits
                || costPreview.profileId !== input.profileId
                || costPreview.configurationFingerprint !== input.configurationFingerprint) {
                throw new Error("AI_EVAL_LIVE_PREVIEW_INVALID");
            }
            const scenarioVersionIds = input.scenarioVersions.map((version) => version.scenarioVersionId);
            const requestFingerprint = createAiEvalScenarioRunRequestFingerprint({
                executionMode: "credentialed_live",
                suiteVersionId: input.suiteVersionId,
                scenarioVersionIds,
                profileId: input.profileId,
                configurationFingerprint: input.configurationFingerprint,
                liveExecutionGateVersion: AI_EVAL_LIVE_GATE_VERSION,
                costPreviewFingerprint: createAiEvalLiveCostPreviewFingerprint(costPreview),
            });
            const result = await client.query(`
                select *
                from public.create_ai_eval_scenario_run_request(
                  $1, $2, $3, 'credentialed_live', $4, $5, $6, $7::uuid[], $8, $9::jsonb
                )
            `, [
                input.operatorUserId,
                input.creationRequestKey,
                requestFingerprint,
                input.suiteVersionId,
                input.profileId,
                input.configurationFingerprint,
                scenarioVersionIds,
                AI_EVAL_LIVE_GATE_VERSION,
                costPreview,
            ]);
            return {
                outcome: readString(result.rows[0]?.outcome) as "created" | "replayed" | "idempotency_conflict",
                runId: readString(result.rows[0]?.ai_eval_scenario_run_id),
                requestFingerprint,
            };
        },

        async listRuns(operatorUserId: string): Promise<AiEvalScenarioRunSummary[]> {
            const result = await client.query(`${RUN_SUMMARY_SELECT}
                where run.requested_by_operator_user_id = $1
                order by run.requested_at desc
            `, [operatorUserId]);
            return result.rows.flatMap((row) => {
                const mapped = mapRunSummary(row);
                return mapped ? [mapped] : [];
            });
        },

        async findRunDetail(operatorUserId: string, runId: string): Promise<AiEvalScenarioRunDetail | null> {
            const summaryResult = await client.query(`${RUN_SUMMARY_SELECT}
                where run.requested_by_operator_user_id = $1
                  and run.ai_eval_scenario_run_id = $2
                limit 1
            `, [operatorUserId, runId]);
            const summary = mapRunSummary(summaryResult.rows[0]);
            if (!summary) return null;
            return loadRunDetail(client, summary);
        },

        async claimNextRun(workerId: string) {
            const result = await client.query(`
                select * from public.claim_next_ai_eval_scenario_run($1, 120)
            `, [workerId]);
            return mapRunSummary(result.rows[0]);
        },

        async claimRun(runId: string, workerId: string) {
            const result = await client.query(`
                select * from public.claim_ai_eval_scenario_run($1, $2, 120)
            `, [runId, workerId]);
            return mapRunSummary(result.rows[0]);
        },

        async claimNextLiveRun(workerId: string) {
            const result = await client.query(`
                select * from public.claim_next_ai_eval_live_scenario_run($1, 300)
            `, [workerId]);
            return mapRunSummary(result.rows[0]);
        },

        async claimLiveRun(runId: string, workerId: string) {
            const result = await client.query(`
                select * from public.claim_ai_eval_live_scenario_run($1, $2, 300)
            `, [runId, workerId]);
            return mapRunSummary(result.rows[0]);
        },

        async renewLiveRunClaim(runId: string, workerId: string) {
            const result = await client.query(`
                update public.ai_eval_scenario_runs
                set claim_expires_at = now() + interval '300 seconds'
                where ai_eval_scenario_run_id = $1
                  and execution_mode = 'credentialed_live'
                  and lifecycle_state = 'running'
                  and claim_worker_id = $2
                  and claim_expires_at > now()
                returning ai_eval_scenario_run_id
            `, [runId, workerId]);
            return Boolean(result.rows[0]);
        },

        async claimLiveOperation(input: {
            runId: string;
            operationKey: string;
            operationKind: AiEvalScenarioLiveOperation["operationKind"];
            inputFingerprint: string;
            profileId: string;
            configurationFingerprint: string;
            workerId: string;
        }) {
            const result = await client.query(`
                select *
                from public.claim_ai_eval_scenario_live_operation(
                  $1, $2, $3, $4, $5, $6, $7, 120
                )
            `, [
                input.runId,
                input.operationKey,
                input.operationKind,
                input.inputFingerprint,
                input.profileId,
                input.configurationFingerprint,
                input.workerId,
            ]);
            return mapLiveOperation(result.rows[0]);
        },

        async completeLiveOperation(input: {
            liveOperationId: string;
            workerId: string;
            claimGeneration: number;
            acceptedOutput: Record<string, unknown>;
        }) {
            const result = await client.query(`
                update public.ai_eval_scenario_live_operations
                set lifecycle_state = 'completed',
                    retryable = false,
                    next_attempt_at = null,
                    claim_worker_id = null,
                    claim_expires_at = null,
                    accepted_output_json = $4::jsonb,
                    failure_json = null,
                    completed_at = now(),
                    updated_at = now()
                where ai_eval_scenario_live_operation_id = $1
                  and lifecycle_state = 'running'
                  and claim_worker_id = $2
                  and claim_generation = $3
                  and claim_expires_at > now()
                returning *
            `, [input.liveOperationId, input.workerId, input.claimGeneration, input.acceptedOutput]);
            return mapLiveOperation(result.rows[0]);
        },

        async failLiveOperation(input: {
            liveOperationId: string;
            workerId: string;
            claimGeneration: number;
            retryable: boolean;
            failure: Record<string, unknown>;
        }) {
            const result = await client.query(`
                update public.ai_eval_scenario_live_operations
                set lifecycle_state = 'failed',
                    retryable = $4 and attempt_count < 3,
                    next_attempt_at = case
                      when $4 and attempt_count < 3 then now() + make_interval(secs => 60 * attempt_count)
                      else null
                    end,
                    claim_worker_id = null,
                    claim_expires_at = null,
                    accepted_output_json = null,
                    failure_json = $5::jsonb,
                    completed_at = now(),
                    updated_at = now()
                where ai_eval_scenario_live_operation_id = $1
                  and lifecycle_state = 'running'
                  and claim_worker_id = $2
                  and claim_generation = $3
                returning *
            `, [
                input.liveOperationId,
                input.workerId,
                input.claimGeneration,
                input.retryable,
                input.failure,
            ]);
            return mapLiveOperation(result.rows[0]);
        },

        async loadClaimedRun(run: AiEvalScenarioRunSummary) {
            return loadRunDetail(client, run);
        },

        async failLiveRunConfiguration(input: {
            runId: string;
            workerId: string;
            errorCode: string;
        }) {
            const result = await client.query(`
                update public.ai_eval_scenario_runs
                set lifecycle_state = 'failed',
                    error_code = $3,
                    claim_worker_id = null,
                    claim_expires_at = null,
                    completed_at = now()
                where ai_eval_scenario_run_id = $1
                  and execution_mode = 'credentialed_live'
                  and lifecycle_state = 'running'
                  and claim_worker_id = $2
                  and claim_expires_at > now()
                returning *
            `, [input.runId, input.workerId, input.errorCode]);
            return mapRunSummary(result.rows[0]);
        },

        async markCaseRunning(runCaseId: string) {
            await client.query(`
                update public.ai_eval_scenario_run_cases
                set lifecycle_state = 'running',
                    assertion_result = null,
                    assertion_reasons_json = '[]'::jsonb,
                    error_code = null,
                    started_at = coalesce(started_at, now()),
                    completed_at = null
                where ai_eval_scenario_run_case_id = $1
                  and lifecycle_state in ('queued', 'running', 'failed')
            `, [runCaseId]);
        },

        async completeLayer(input: {
            runLayerId: string;
            assertionResult: AiEvalScenarioAssertionResult;
            assertionReasons: string[];
            output: Record<string, unknown>;
            diagnostics: Record<string, unknown> | null;
        }) {
            await client.query(`
                update public.ai_eval_scenario_run_layers
                set lifecycle_state = 'completed',
                    assertion_result = $2,
                    assertion_reasons_json = $3::jsonb,
                    output_json = $4::jsonb,
                    diagnostics_json = $5::jsonb,
                    error_code = null,
                    started_at = coalesce(started_at, now()),
                    completed_at = now()
                where ai_eval_scenario_run_layer_id = $1
                  and lifecycle_state in ('queued', 'running', 'failed')
            `, [
                input.runLayerId,
                input.assertionResult,
                JSON.stringify(input.assertionReasons),
                input.output,
                input.diagnostics,
            ]);
        },

        async failLayer(runLayerId: string, errorCode: string) {
            await client.query(`
                update public.ai_eval_scenario_run_layers
                set lifecycle_state = 'failed',
                    assertion_result = 'fail',
                    assertion_reasons_json = jsonb_build_array($3::text),
                    output_json = null,
                    diagnostics_json = null,
                    error_code = $2,
                    started_at = coalesce(started_at, now()),
                    completed_at = now()
                where ai_eval_scenario_run_layer_id = $1
                  and lifecycle_state in ('queued', 'running', 'failed')
            `, [runLayerId, errorCode, `Layer execution failed: ${errorCode}`]);
        },

        async finalizeCase(runCaseId: string) {
            const result = await client.query(`
                with aggregate as (
                  select
                    count(*) filter (where lifecycle_state = 'completed') as completed_count,
                    count(*) filter (where lifecycle_state = 'failed') as failed_count,
                    count(*) as layer_count,
                    bool_or(assertion_result = 'fail') as has_failure,
                    bool_or(assertion_result = 'review_required') as needs_review
                  from public.ai_eval_scenario_run_layers
                  where ai_eval_scenario_run_case_id = $1
                )
                update public.ai_eval_scenario_run_cases run_case
                set lifecycle_state = case when aggregate.failed_count > 0 then 'failed' else 'completed' end,
                    assertion_result = case
                      when aggregate.failed_count > 0 or aggregate.has_failure then 'fail'
                      when aggregate.needs_review then 'review_required'
                      else 'pass'
                    end,
                    assertion_reasons_json = case
                      when aggregate.failed_count > 0 then jsonb_build_array('One or more output layers failed.')
                      when aggregate.has_failure then jsonb_build_array('One or more output-layer assertions failed.')
                      when aggregate.needs_review then jsonb_build_array('Operator review is required for teaching quality and naturalness.')
                      else '[]'::jsonb
                    end,
                    error_code = case when aggregate.failed_count > 0 then 'LAYER_EXECUTION_FAILED' else null end,
                    completed_at = now()
                from aggregate
                where run_case.ai_eval_scenario_run_case_id = $1
                  and aggregate.completed_count + aggregate.failed_count = aggregate.layer_count
                returning run_case.*
            `, [runCaseId]);
            return result.rows[0] ?? null;
        },

        async finalizeRun(runId: string) {
            const result = await client.query(`
                with aggregate as (
                  select
                    count(*) filter (where lifecycle_state = 'completed') as completed_count,
                    count(*) filter (where lifecycle_state = 'failed') as failed_count,
                    count(*) as case_count,
                    bool_or(assertion_result = 'fail') as has_failure,
                    bool_or(assertion_result = 'review_required') as needs_review
                  from public.ai_eval_scenario_run_cases
                  where ai_eval_scenario_run_id = $1
                )
                update public.ai_eval_scenario_runs run
                set lifecycle_state = case
                      when aggregate.completed_count + aggregate.failed_count < aggregate.case_count then 'partial'
                      when aggregate.failed_count > 0 then 'partial'
                      else 'completed'
                    end,
                    completed_case_count = aggregate.completed_count,
                    failed_case_count = aggregate.failed_count,
                    assertion_result = case
                      when aggregate.has_failure or aggregate.failed_count > 0 then 'fail'
                      when aggregate.needs_review then 'review_required'
                      else 'pass'
                    end,
                    error_code = case when aggregate.failed_count > 0 then 'CASE_EXECUTION_INCOMPLETE' else null end,
                    claim_worker_id = null,
                    claim_expires_at = null,
                    completed_at = case
                      when aggregate.completed_count = aggregate.case_count then now()
                      else null
                    end
                from aggregate
                where run.ai_eval_scenario_run_id = $1
                  and run.lifecycle_state = 'running'
                returning run.*
            `, [runId]);
            return mapRunSummary(result.rows[0]);
        },

        async finalizeLiveRun(runId: string) {
            const result = await client.query(`
                with case_aggregate as (
                  select
                    count(*) filter (where lifecycle_state = 'completed') as completed_count,
                    count(*) filter (where lifecycle_state = 'failed') as failed_count,
                    count(*) as case_count,
                    bool_or(assertion_result = 'fail') as has_failure,
                    bool_or(assertion_result = 'review_required') as needs_review
                  from public.ai_eval_scenario_run_cases
                  where ai_eval_scenario_run_id = $1
                ), operation_aggregate as (
                  select
                    bool_or(lifecycle_state = 'failed' and retryable) as has_retryable_failure,
                    bool_or(lifecycle_state = 'failed' and not retryable) as has_terminal_failure
                  from public.ai_eval_scenario_live_operations
                  where ai_eval_scenario_run_id = $1
                ), resolved as (
                  select
                    case_aggregate.*,
                    coalesce(operation_aggregate.has_retryable_failure, false) as has_retryable_failure,
                    coalesce(operation_aggregate.has_terminal_failure, false) as has_terminal_failure
                  from case_aggregate cross join operation_aggregate
                )
                update public.ai_eval_scenario_runs run
                set lifecycle_state = case
                      when resolved.completed_count = resolved.case_count then 'completed'
                      when resolved.has_terminal_failure then 'failed'
                      when resolved.has_retryable_failure then 'partial'
                      when run.claim_generation >= 5 then 'failed'
                      else 'partial'
                    end,
                    completed_case_count = resolved.completed_count,
                    failed_case_count = resolved.failed_count,
                    assertion_result = case
                      when resolved.has_failure or resolved.failed_count > 0 then 'fail'
                      when resolved.needs_review then 'review_required'
                      else 'pass'
                    end,
                    error_code = case
                      when resolved.completed_count = resolved.case_count then null
                      when resolved.has_terminal_failure then 'LIVE_PROVIDER_OPERATION_TERMINAL'
                      when resolved.has_retryable_failure then 'RETRYABLE_WORK_REMAINS'
                      when run.claim_generation >= 5 then 'PROJECTION_RETRY_EXHAUSTED'
                      else 'PROJECTION_RETRY_REQUIRED'
                    end,
                    claim_worker_id = null,
                    claim_expires_at = null,
                    completed_at = case
                      when resolved.completed_count = resolved.case_count
                        or resolved.has_terminal_failure
                        or run.claim_generation >= 5 then now()
                      else null
                    end
                from resolved
                where run.ai_eval_scenario_run_id = $1
                  and run.execution_mode = 'credentialed_live'
                  and run.lifecycle_state = 'running'
                returning run.*
            `, [runId]);
            return mapRunSummary(result.rows[0]);
        },
    };
}

const RUN_SUMMARY_SELECT = `
    select
      run.ai_eval_scenario_run_id,
      run.execution_mode,
      run.lifecycle_state,
      run.profile_id,
      run.configuration_fingerprint,
      run.cost_preview_json,
      run.case_count,
      run.completed_case_count,
      run.failed_case_count,
      run.assertion_result,
      to_char(run.requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as requested_at,
      case when run.completed_at is null then null else
        to_char(run.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end as completed_at,
      to_char(run.retention_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as retention_expires_at
    from public.ai_eval_scenario_runs run
`;

async function loadRunDetail(client: AiEvalScenarioQueryClient, summary: AiEvalScenarioRunSummary) {
    const result = await client.query(`
        select
          run_case.ai_eval_scenario_run_case_id,
          run_case.ai_eval_scenario_version_id,
          run_case.ordinal,
          run_case.lifecycle_state as case_lifecycle_state,
          run_case.assertion_result as case_assertion_result,
          run_case.assertion_reasons_json as case_assertion_reasons,
          run_case.error_code as case_error_code,
          version.input_fingerprint,
          version.scenario_payload_json,
          layer.ai_eval_scenario_run_layer_id,
          layer.output_layer,
          layer.lifecycle_state as layer_lifecycle_state,
          layer.assertion_result as layer_assertion_result,
          layer.assertion_reasons_json as layer_assertion_reasons,
          layer.candidate_visible,
          layer.output_json,
          layer.diagnostics_json,
          layer.error_code as layer_error_code
        from public.ai_eval_scenario_run_cases run_case
        join public.ai_eval_scenario_versions version
          on version.ai_eval_scenario_version_id = run_case.ai_eval_scenario_version_id
        left join public.ai_eval_scenario_run_layers layer
          on layer.ai_eval_scenario_run_case_id = run_case.ai_eval_scenario_run_case_id
        where run_case.ai_eval_scenario_run_id = $1
        order by run_case.ordinal,
          case layer.output_layer
            when 'evaluator_diagnostics' then 1
            when 'session_coaching' then 2
            when 'transcript_evidence' then 3
            when 'coach_update' then 4
            when 'invited_completion' then 5
            when 'candidate_dashboard' then 6
            else 99
          end
    `, [summary.runId]);
    const cases = new Map<string, AiEvalScenarioRunCase>();
    for (const row of result.rows) {
        const runCaseId = readString(row.ai_eval_scenario_run_case_id);
        const scenario = safeScenario(row.scenario_payload_json);
        if (!runCaseId || !scenario) continue;
        let runCase = cases.get(runCaseId);
        if (!runCase) {
            runCase = {
                runCaseId,
                scenarioVersionId: readString(row.ai_eval_scenario_version_id),
                scenario,
                inputFingerprint: readString(row.input_fingerprint),
                ordinal: readNumber(row.ordinal),
                lifecycleState: readCaseState(row.case_lifecycle_state),
                assertionResult: readAssertionResult(row.case_assertion_result),
                assertionReasons: readStringArray(row.case_assertion_reasons),
                errorCode: readNullableString(row.case_error_code),
                layers: [],
            };
            cases.set(runCaseId, runCase);
        }
        const outputLayer = readOutputLayer(row.output_layer);
        if (outputLayer) {
            runCase.layers.push({
                runLayerId: readString(row.ai_eval_scenario_run_layer_id),
                outputLayer,
                lifecycleState: readLayerState(row.layer_lifecycle_state),
                assertionResult: readAssertionResult(row.layer_assertion_result),
                assertionReasons: readStringArray(row.layer_assertion_reasons),
                candidateVisible: row.candidate_visible === true,
                output: readRecord(row.output_json),
                diagnostics: readRecord(row.diagnostics_json),
                errorCode: readNullableString(row.layer_error_code),
            });
        }
    }
    return { ...summary, cases: Array.from(cases.values()).sort((left, right) => left.ordinal - right.ordinal) };
}

function mapScenarioDraft(row: Record<string, unknown> | undefined): AiEvalScenarioDraft | null {
    if (!row) return null;
    const scenario = safeScenario(row.scenario_payload_json);
    if (!scenario) return null;
    return {
        draftId: readString(row.ai_eval_scenario_draft_id),
        ownerOperatorUserId: readString(row.owner_operator_user_id),
        creationRequestKey: readString(row.creation_request_key),
        scenario,
        lifecycleState: row.lifecycle_state === "archived" ? "archived" : "active",
        revision: readNumber(row.revision),
        createdAt: readString(row.created_at),
        updatedAt: readString(row.updated_at),
    };
}

function mapScenarioVersion(row: Record<string, unknown> | undefined): AiEvalScenarioVersion | null {
    if (!row) return null;
    const scenario = safeScenario(row.scenario_payload_json);
    if (!scenario) return null;
    return {
        scenarioVersionId: readString(row.ai_eval_scenario_version_id),
        sourceDraftId: readNullableString(row.source_draft_id),
        sourceKind: row.source_kind === "operator" ? "operator" : "baseline",
        scenario,
        versionNumber: readNumber(row.version_number),
        inputFingerprint: readString(row.input_fingerprint),
        stagedAt: readString(row.staged_at),
    };
}

function mapRunSummary(row: Record<string, unknown> | undefined): AiEvalScenarioRunSummary | null {
    if (!row) return null;
    const runId = readString(row.ai_eval_scenario_run_id);
    const lifecycleState = readRunState(row.lifecycle_state);
    if (!runId || !lifecycleState) return null;
    return {
        runId,
        executionMode: readExecutionMode(row.execution_mode),
        lifecycleState,
        profileId: readString(row.profile_id),
        configurationFingerprint: readString(row.configuration_fingerprint),
        costPreview: parseAiEvalLiveCostPreview(row.cost_preview_json),
        caseCount: readNumber(row.case_count),
        completedCaseCount: readNumber(row.completed_case_count),
        failedCaseCount: readNumber(row.failed_case_count),
        assertionResult: readAssertionResult(row.assertion_result),
        requestedAt: readString(row.requested_at),
        completedAt: readNullableString(row.completed_at),
        retentionExpiresAt: readString(row.retention_expires_at),
    };
}

function mapLiveOperation(row: Record<string, unknown> | undefined): AiEvalScenarioLiveOperation | null {
    if (!row) return null;
    const lifecycleState = readLiveOperationState(row.lifecycle_state);
    const operationKind = row.operation_kind === "coach_update"
        ? "coach_update" as const
        : row.operation_kind === "answer_evaluation"
            ? "answer_evaluation" as const
            : null;
    if (!lifecycleState || !operationKind) return null;
    return {
        liveOperationId: readString(row.ai_eval_scenario_live_operation_id),
        runId: readString(row.ai_eval_scenario_run_id),
        operationKey: readString(row.operation_key),
        operationKind,
        inputFingerprint: readString(row.input_fingerprint),
        profileId: readString(row.profile_id),
        configurationFingerprint: readString(row.configuration_fingerprint),
        lifecycleState,
        attemptCount: readNumber(row.attempt_count),
        retryable: row.retryable === true,
        nextAttemptAt: readNullableString(row.next_attempt_at),
        claimWorkerId: readNullableString(row.claim_worker_id),
        claimGeneration: readNumber(row.claim_generation),
        acceptedOutput: readRecord(row.accepted_output_json),
        failure: readRecord(row.failure_json),
    };
}

function safeScenario(value: unknown) {
    try {
        return parseAiEvalScenario(value);
    } catch {
        return null;
    }
}

function readString(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
    return value === null || typeof value === "undefined" ? null : readString(value) || null;
}

function readNumber(value: unknown) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return 0;
}

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function readStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readAssertionResult(value: unknown): AiEvalScenarioAssertionResult | null {
    return value === "pass" || value === "fail" || value === "review_required" ? value : null;
}

function readRunState(value: unknown): AiEvalScenarioRunState | null {
    return value === "queued" || value === "running" || value === "partial" || value === "completed"
        || value === "failed" || value === "cancelled_before_start" ? value : null;
}

function readCaseState(value: unknown): AiEvalScenarioRunCase["lifecycleState"] {
    return value === "running" || value === "completed" || value === "failed" ? value : "queued";
}

function readLayerState(value: unknown): AiEvalScenarioRunLayer["lifecycleState"] {
    return value === "running" || value === "completed" || value === "failed" ? value : "queued";
}

function readLiveOperationState(value: unknown): AiEvalScenarioLiveOperation["lifecycleState"] | null {
    return value === "queued" || value === "running" || value === "completed" || value === "failed"
        ? value
        : null;
}

function readOutputLayer(value: unknown): AiEvalScenarioOutputLayer | null {
    return AI_EVAL_SCENARIO_OUTPUT_LAYERS.includes(value as AiEvalScenarioOutputLayer)
        ? value as AiEvalScenarioOutputLayer
        : null;
}

function readExecutionMode(value: unknown): AiEvalScenarioRunSummary["executionMode"] {
    return value === "credentialed_live" || value === "same_profile_regression"
        ? value
        : "contract_fixture";
}

export function getScenarioVersionInputFingerprint(scenario: AiEvalScenario) {
    return createAiEvalScenarioFingerprint(scenario);
}

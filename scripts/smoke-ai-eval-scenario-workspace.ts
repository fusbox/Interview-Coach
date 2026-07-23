import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { aiEvalScenarioBaselineCases } from "../src/features/ai-eval-v2/ai-eval-scenario-baseline";
import {
    createAiEvalScenarioFingerprint,
    parseAiEvalScenario,
} from "../src/features/ai-eval-v2/ai-eval-scenario-contract";
import { createAiEvalScenarioRepository } from "../src/features/ai-eval-v2/ai-eval-scenario-repository";
import {
    AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT,
    AI_EVAL_LIVE_PROFILE_ID,
    createAiEvalLiveCostPreview,
} from "../src/features/ai-eval-v2/ai-eval-live-run-contract";
import { runNextAiEvalScenarioFixtureJob } from "../src/features/ai-eval-v2/ai-eval-scenario-worker";
import { candidateAnswerAnalysisFixtureRunMetadata } from "../src/features/candidate-session-v2/candidate-answer-analysis-fixture";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl(),
        max: 1,
        application_name: "interview-coach-ai-eval-scenario-smoke",
    });
    const client = await pool.connect();
    const operatorUserId = randomUUID();

    try {
        await client.query("begin");
        await client.query(`
            insert into public.app_users (user_id, email, display_name, status)
            values ($1, $2, 'Scenario smoke operator', 'active')
        `, [operatorUserId, `scenario-smoke-${operatorUserId}@example.invalid`]);
        await client.query(`
            insert into public.ai_eval_operator_grants (user_id, granted_by_user_id, reason)
            values ($1, $1, 'Rollback-only scenario workspace smoke')
        `, [operatorUserId]);

        const repository = createAiEvalScenarioRepository({
            query: (sql, values) => client.query(sql, values),
        });
        const baseline = await repository.synchronizeBaseline(operatorUserId);
        assert(baseline.scenarioCount === aiEvalScenarioBaselineCases.length, "Baseline scenario count drifted.");
        const replayedBaseline = await repository.synchronizeBaseline(operatorUserId);
        assert(
            replayedBaseline.suiteId === baseline.suiteId
            && replayedBaseline.scenarioCount === baseline.scenarioCount,
            "Baseline suite fast replay drifted.",
        );

        const versions = await repository.listScenarioVersions(operatorUserId);
        const baselineVersion = versions.find((version) => version.scenario.scenarioKey === "strong_content_typed");
        assert(baselineVersion, "Representative baseline version did not synchronize.");

        const suffix = operatorUserId.replace(/-/g, "").slice(0, 8);
        const clonedScenario = parseAiEvalScenario({
            ...baselineVersion.scenario,
            scenarioKey: `operator_clone_${suffix}`,
            title: "Operator clone smoke",
        });
        assert(clonedScenario.kind === "atomic_answer", "Representative baseline clone was not atomic.");
        const creationRequestKey = randomUUID();
        const created = await repository.createDraft({
            operatorUserId,
            creationRequestKey,
            scenario: clonedScenario,
        });
        assert(created.outcome === "created" && created.draft, "Scenario draft was not created.");

        const replayed = await repository.createDraft({
            operatorUserId,
            creationRequestKey,
            scenario: clonedScenario,
        });
        assert(replayed.outcome === "replayed", "Exact scenario draft replay did not converge.");
        const conflictedDraft = await repository.createDraft({
            operatorUserId,
            creationRequestKey,
            scenario: parseAiEvalScenario({ ...clonedScenario, title: "Changed reuse" }),
        });
        assert(conflictedDraft.outcome === "idempotency_conflict", "Changed draft idempotency reuse did not conflict.");

        const revisedScenario = parseAiEvalScenario({ ...clonedScenario, title: "Operator clone revised" });
        const revisedDraft = await repository.updateDraft({
            operatorUserId,
            draftId: created.draft.draftId,
            expectedRevision: created.draft.revision,
            scenario: revisedScenario,
        });
        assert(revisedDraft?.revision === 2, "Scenario draft optimistic revision did not advance.");
        const stagedVersion = await repository.stageDraft({
            operatorUserId,
            draftId: revisedDraft.draftId,
            expectedRevision: revisedDraft.revision,
            inputFingerprint: createAiEvalScenarioFingerprint(revisedScenario),
        });
        assert(stagedVersion?.inputFingerprint === createAiEvalScenarioFingerprint(revisedScenario), "Staged fingerprint drifted.");
        const replayedStagedVersion = await repository.stageDraft({
            operatorUserId,
            draftId: revisedDraft.draftId,
            expectedRevision: revisedDraft.revision,
            inputFingerprint: createAiEvalScenarioFingerprint(revisedScenario),
        });
        assert(
            replayedStagedVersion?.scenarioVersionId === stagedVersion.scenarioVersionId,
            "Exact draft-revision staging did not converge.",
        );

        const runRequestKey = randomUUID();
        const submitted = await repository.submitRun({
            operatorUserId,
            creationRequestKey: runRequestKey,
            suiteVersionId: null,
            scenarioVersions: [baselineVersion, stagedVersion],
            profileId: "deterministic_local_fixture_v1",
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
        });
        assert(submitted.outcome === "created" && submitted.runId, "Scenario run was not created.");
        const replayedRun = await repository.submitRun({
            operatorUserId,
            creationRequestKey: runRequestKey,
            suiteVersionId: null,
            scenarioVersions: [baselineVersion, stagedVersion],
            profileId: "deterministic_local_fixture_v1",
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
        });
        assert(replayedRun.outcome === "replayed", "Exact scenario run replay did not converge.");
        const conflictedRun = await repository.submitRun({
            operatorUserId,
            creationRequestKey: runRequestKey,
            suiteVersionId: null,
            scenarioVersions: [baselineVersion],
            profileId: "deterministic_local_fixture_v1",
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
        });
        assert(conflictedRun.outcome === "idempotency_conflict", "Changed scenario run reuse did not conflict.");

        const worker = await runNextAiEvalScenarioFixtureJob({
            repository,
            workerId: `scenario-smoke:${operatorUserId}`,
        });
        assert(worker.status === "completed", "Contract fixture worker did not complete the run.");
        const detail = await repository.findRunDetail(operatorUserId, submitted.runId);
        assert(detail?.lifecycleState === "completed", "Completed scenario run did not recover by operator ownership.");
        assert(detail.cases.length === 2, "Scenario run case count drifted.");
        assert(
            detail.cases.every((runCase) => runCase.layers.every((layer) => layer.lifecycleState === "completed" && layer.output)),
            "One or more candidate-visible scenario layers were not durably completed.",
        );
        const retentionMs = Date.parse(detail.retentionExpiresAt) - Date.parse(detail.requestedAt);
        assert(retentionMs >= 29 * 86_400_000 && retentionMs <= 31 * 86_400_000, "Run retention deadline is not near 30 days.");

        const audits = await client.query(`
            select metadata
            from public.auth_audit_events
            where user_id = $1
              and event_type = 'ai_eval_scenario_mutated'
        `, [operatorUserId]);
        assert(audits.rows.length > 0, "Scenario metadata audit was not emitted.");
        const auditText = JSON.stringify(audits.rows);
        assert(!auditText.includes(clonedScenario.answer.text), "Scenario content leaked into auth audit metadata.");
        assert(!auditText.includes("scenario_payload_json") && !auditText.includes("output_json"), "Artifact fields leaked into auth audit metadata.");

        const livePreview = createAiEvalLiveCostPreview({
            requestedCaseCount: 1,
            versions: [baselineVersion],
            dependencyCaseCount: 0,
            policy: {
                enabled: true,
                ready: true,
                reasons: [],
                inputUsdPerMillionTokens: 0.1,
                outputUsdPerMillionTokens: 0.4,
                maxEstimatedCostUsd: 5,
                maxCalls: 10,
                concurrency: 1,
                profileId: AI_EVAL_LIVE_PROFILE_ID,
                configurationFingerprint: AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT,
            },
        });
        const liveSubmitted = await repository.submitLiveRun({
            operatorUserId,
            creationRequestKey: randomUUID(),
            suiteVersionId: null,
            scenarioVersions: [baselineVersion],
            profileId: AI_EVAL_LIVE_PROFILE_ID,
            configurationFingerprint: AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT,
            costPreview: livePreview,
        });
        assert(liveSubmitted.outcome === "created" && liveSubmitted.runId, "Credentialed live run was not queued.");
        const liveWorkerId = `scenario-live-smoke:${operatorUserId}`;
        const liveClaim = await repository.claimLiveRun(liveSubmitted.runId, liveWorkerId);
        assert(liveClaim?.lifecycleState === "running", "Credentialed live run was not claimed by the live-only claim.");
        const liveOperation = await repository.claimLiveOperation({
            runId: liveSubmitted.runId,
            operationKey: "answer_evaluation:smoke",
            operationKind: "answer_evaluation",
            inputFingerprint: baselineVersion.inputFingerprint,
            profileId: AI_EVAL_LIVE_PROFILE_ID,
            configurationFingerprint: AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT,
            workerId: liveWorkerId,
        });
        assert(liveOperation?.lifecycleState === "running" && liveOperation.attemptCount === 1, "Live operation was not claimed once.");
        const completedLiveOperation = await repository.completeLiveOperation({
            liveOperationId: liveOperation.liveOperationId,
            workerId: liveWorkerId,
            claimGeneration: liveOperation.claimGeneration,
            acceptedOutput: { status: "accepted_smoke_checkpoint" },
        });
        assert(completedLiveOperation?.lifecycleState === "completed", "Accepted live operation was not checkpointed.");
        const recoveredLiveOperation = await repository.claimLiveOperation({
            runId: liveSubmitted.runId,
            operationKey: "answer_evaluation:smoke",
            operationKind: "answer_evaluation",
            inputFingerprint: baselineVersion.inputFingerprint,
            profileId: AI_EVAL_LIVE_PROFILE_ID,
            configurationFingerprint: AI_EVAL_LIVE_CONFIGURATION_FINGERPRINT,
            workerId: liveWorkerId,
        });
        assert(
            recoveredLiveOperation?.lifecycleState === "completed" && recoveredLiveOperation.attemptCount === 1,
            "Accepted live operation recovery attempted another provider operation.",
        );
        const terminalLiveRun = await repository.failLiveRunConfiguration({
            runId: liveSubmitted.runId,
            workerId: liveWorkerId,
            errorCode: "SMOKE_CONFIGURATION_STOP",
        });
        assert(terminalLiveRun?.lifecycleState === "failed", "Invalid live worker configuration did not terminalize its claimed run.");

        await client.query("savepoint revoked_grant_check");
        await client.query(`
            update public.ai_eval_operator_grants
            set lifecycle_state = 'revoked', revoked_by_user_id = $1, revoked_at = now()
            where user_id = $1 and lifecycle_state = 'active'
        `, [operatorUserId]);
        let grantBlocked = false;
        try {
            await repository.createDraft({
                operatorUserId,
                creationRequestKey: randomUUID(),
                scenario: parseAiEvalScenario({
                    ...revisedScenario,
                    scenarioKey: `revoked_clone_${suffix}`,
                    title: "Must be blocked",
                }),
            });
        } catch {
            grantBlocked = true;
            await client.query("rollback to savepoint revoked_grant_check");
        }
        assert(grantBlocked, "Revoked individual operator grant did not block scenario content mutation.");

        console.log(JSON.stringify({
            baselineScenarioCount: baseline.scenarioCount,
            draftLifecycle: ["created", "replayed", "idempotency_conflict", "revised", "staged"],
            runLifecycle: ["created", "replayed", "idempotency_conflict", "claimed", "completed", "recovered"],
            durableCaseCount: detail.cases.length,
            durableLayerCount: detail.cases.reduce((sum, runCase) => sum + runCase.layers.length, 0),
            liveExecution: ["previewed", "queued", "claimed", "operation_checkpointed", "checkpoint_recovered", "terminalized"],
            grantBlocked,
            auditContentFree: true,
        }, null, 2));
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
});

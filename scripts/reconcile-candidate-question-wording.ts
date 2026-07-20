import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import { handleCandidatePracticeIntentStartRequest } from "../src/app/candidate/practice/ready/[intentId]/start/route-implementation";
import { handleCandidateSetupStartRequest } from "../src/app/candidate/setup/start/route-implementation";
import { createCandidateFollowUpSessionInputFromIntent } from "../src/features/candidate-practice-v2/candidate-follow-up-session-creation";
import type { CandidatePracticeIntentRecord } from "../src/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import { createCandidatePracticeIntentLaunchRepository } from "../src/features/candidate-practice-v2/candidate-practice-intent-launch-repository";
import { createCandidatePracticeIntentRepository } from "../src/features/candidate-practice-v2/candidate-practice-intent-repository";
import { createCandidatePracticeSessionRepository } from "../src/features/candidate-session-v2/candidate-practice-session-repository";
import {
    CANDIDATE_QUESTION_WORDING_PRODUCTION_PROMPT_VERSION,
    CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION,
    createCandidateQuestionWordingRuntime,
    createFaultInjectionCandidateQuestionWordingRuntime,
} from "../src/features/candidate-session-v2/candidate-question-wording-runtime";
import {
    GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
    GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL,
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
    GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER,
} from "../src/features/candidate-session-v2/google-candidate-question-wording";
import { createCandidateSetupEntryRepository } from "../src/features/candidate-setup-v2/candidate-setup-entry-context";
import { createCandidateSetupPrepContextRepository } from "../src/features/candidate-setup-v2/candidate-setup-prep-context-repository";
import { createCandidateSetupStartRequestRepository } from "../src/features/candidate-setup-v2/candidate-setup-start-request-repository";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const PRIMARY_CANDIDATE_PROFILE_ID = "10000000-0000-4000-8000-000000000001";

void main();

async function main() {
    const databaseUrl = process.env.DATABASE_URL?.trim() || getSmokeDatabaseUrl();
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: readSslConfig(databaseUrl),
        max: 1,
        application_name: "interview-coach-question-wording-reconciliation",
    });
    const client = await pool.connect();
    const runNow = new Date();

    try {
        await client.query("begin");
        const queryClient = createQueryClient(client);
        await assertSeedCandidateExists(client);

        const practiceSessionRepository = createCandidatePracticeSessionRepository(queryClient);
        const practiceIntentRepository = createCandidatePracticeIntentRepository(queryClient);
        const practiceIntentLaunchRepository = createCandidatePracticeIntentLaunchRepository(queryClient);
        const prepContextResolver = createCandidateSetupPrepContextRepository(queryClient);
        const setupEntryRepository = createCandidateSetupEntryRepository(queryClient);
        const setupStartRequestRepository = createCandidateSetupStartRequestRepository(queryClient);
        const repositoryProbeKeyHash = createHash("sha256").update(`probe-key-${randomUUID()}`).digest("hex");
        const repositoryProbeFingerprint = createHash("sha256").update("probe-request").digest("hex");
        const repositoryProbe = await setupStartRequestRepository.claimSetupStart({
            candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
            idempotencyKeyHash: repositoryProbeKeyHash,
            requestFingerprint: repositoryProbeFingerprint,
            claimedAt: runNow.toISOString(),
            claimExpiresAt: new Date(runNow.getTime() + 60_000).toISOString(),
            requestExpiresAt: new Date(runNow.getTime() + 24 * 60 * 60_000).toISOString(),
        });
        assert.equal(repositoryProbe?.outcome, "acquired");
        assert(repositoryProbe);
        assert.equal(await setupStartRequestRepository.failSetupStart({
            candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
            ...repositoryProbe,
            failedAt: runNow.toISOString(),
            errorCode: "RECONCILIATION_PROBE_COMPLETE",
        }), true);
        let wordingGenerationCallCount = 0;
        const acceptedRuntime = createCandidateQuestionWordingRuntime({
            adapter: {
                metadata: {
                    provider: GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER,
                    modelName: GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL,
                    promptVersion: CANDIDATE_QUESTION_WORDING_PRODUCTION_PROMPT_VERSION,
                    profileId: GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID,
                    configurationFingerprint: GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
                },
                async generate(request) {
                    wordingGenerationCallCount += 1;
                    return {
                        rawText: JSON.stringify({
                            status: CANDIDATE_QUESTION_WORDING_PROVIDER_OUTPUT_VERSION,
                            requestFingerprint: request.requestFingerprint,
                            questions: request.slots.map((slot) => ({
                                slotId: slot.slotId,
                                category: slot.category,
                                questionText: `How would you demonstrate ${slot.category.replaceAll("_", " ")} readiness for ${request.targetRole} in example ${slot.index + 1}?`,
                            })),
                        }),
                        tokenUsage: { inputTokens: 101, outputTokens: 47 },
                    };
                },
            },
            now: createAdvancingClock(runNow),
        });

        const uniqueSuffix = randomUUID().slice(0, 8);
        const acceptedIdempotencyKey = `wording-reconciliation-${randomUUID()}`;
        const acceptedResponse = await handleCandidateSetupStartRequest({
            request: createSetupRequest({
                targetRole: `Question wording reconciliation ${uniqueSuffix}`,
                jobDescription: "Inspect finished goods, document defects, follow safety procedures, and communicate quality findings.",
                idempotencyKey: acceptedIdempotencyKey,
            }),
            now: runNow,
            createSessionId: randomUUID,
            resolveCandidateSetupIdentity: async () => ({
                candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
                candidateLaunchSessionId: null,
                trustedSetupContext: null,
                allowManualPrepContextCreation: true,
                allowBrowserBridgeFallback: false,
            }),
            prepContextResolver,
            setupEntryRepository,
            practiceSessionRepository,
            setupStartRequestRepository,
            questionWordingRuntime: acceptedRuntime,
        });
        const acceptedBody = await readJsonRecord(acceptedResponse);
        assert.equal(acceptedResponse.status, 201, JSON.stringify(acceptedBody));
        const acceptedSessionId = readRequiredString(acceptedBody.sessionId, "accepted session id");
        const acceptedSession = await practiceSessionRepository.findSetupSession({
            candidatePracticeSessionId: acceptedSessionId,
            candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
        });
        assert(acceptedSession?.questionWordingSnapshot);
        assert.equal(acceptedSession.questionWordingStatus, "worded");
        assert.equal(acceptedSession.questionWordingSnapshot.generation?.provider, GOOGLE_CANDIDATE_QUESTION_WORDING_PROVIDER);
        assert.equal(acceptedSession.questionWordingSnapshot.generation?.modelName, GOOGLE_CANDIDATE_QUESTION_WORDING_MODEL);
        assert.equal(acceptedSession.questionWordingSnapshot.generation?.profileId, GOOGLE_CANDIDATE_QUESTION_WORDING_PROFILE_ID);
        assert.equal(
            acceptedSession.questionWordingSnapshot.generation?.configurationFingerprint,
            GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
        );
        assert.equal(acceptedSession.questionWordingSnapshot.questions.length, 3);
        assert.equal(wordingGenerationCallCount, 1);

        const replayedResponse = await handleCandidateSetupStartRequest({
            request: createSetupRequest({
                targetRole: `Question wording reconciliation ${uniqueSuffix}`,
                jobDescription: "Inspect finished goods, document defects, follow safety procedures, and communicate quality findings.",
                idempotencyKey: acceptedIdempotencyKey,
            }),
            now: new Date(runNow.getTime() + 1_000),
            createSessionId: randomUUID,
            resolveCandidateSetupIdentity: async () => ({
                candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
                candidateLaunchSessionId: null,
                trustedSetupContext: null,
                allowManualPrepContextCreation: true,
                allowBrowserBridgeFallback: false,
            }),
            prepContextResolver,
            setupEntryRepository,
            practiceSessionRepository,
            setupStartRequestRepository,
            questionWordingRuntime: acceptedRuntime,
        });
        assert.equal(replayedResponse.status, 200);
        const replayedBody = await readJsonRecord(replayedResponse);
        assert.equal(replayedBody.sessionId, acceptedSessionId);
        assert.equal(wordingGenerationCallCount, 1);

        const conflictResponse = await handleCandidateSetupStartRequest({
            request: createSetupRequest({
                targetRole: `Question wording reconciliation ${uniqueSuffix}`,
                jobDescription: "A changed setup must not reuse the accepted request key.",
                idempotencyKey: acceptedIdempotencyKey,
            }),
            now: new Date(runNow.getTime() + 2_000),
            createSessionId: randomUUID,
            resolveCandidateSetupIdentity: async () => ({
                candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
                candidateLaunchSessionId: null,
                trustedSetupContext: null,
                allowManualPrepContextCreation: true,
                allowBrowserBridgeFallback: false,
            }),
            prepContextResolver,
            setupEntryRepository,
            practiceSessionRepository,
            setupStartRequestRepository,
            questionWordingRuntime: acceptedRuntime,
        });
        assert.equal(conflictResponse.status, 409);
        const conflictBody = await readJsonRecord(conflictResponse);
        assert.equal(conflictBody.code, "SETUP_START_IDEMPOTENCY_CONFLICT");
        assert.equal(wordingGenerationCallCount, 1);

        const immutableWordingSnapshot = JSON.stringify(acceptedSession.questionWordingSnapshot);
        const recoveredSession = await createCandidatePracticeSessionRepository(queryClient).findSetupSession({
            candidatePracticeSessionId: acceptedSessionId,
            candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
        });
        assert.equal(JSON.stringify(recoveredSession?.questionWordingSnapshot), immutableWordingSnapshot);
        assert.equal(wordingGenerationCallCount, 1);

        const sourceQuestion = acceptedSession.questionWordingSnapshot.questions[0];
        assert(sourceQuestion);
        assert(acceptedSession.roleProfileId);
        const followUpIntentTemplate = createFollowUpIntent({
            sourceSessionId: acceptedSessionId,
            roleProfileId: acceptedSession.roleProfileId,
            targetRole: acceptedSession.setupSnapshot.targetRole,
            jobDescription: acceptedSession.setupSnapshot.jobDescription,
            sourceQuestion,
            now: new Date(runNow.getTime() + 4 * 60_000),
        });
        const createdFollowUpIntent = await practiceIntentRepository.createPracticeIntent({
            candidateProfileId: followUpIntentTemplate.candidateProfileId,
            source: followUpIntentTemplate.source,
            roleProfileId: followUpIntentTemplate.roleProfileId,
            targetInterviewId: followUpIntentTemplate.targetInterviewId,
            targetRole: followUpIntentTemplate.targetRole,
            setupContext: followUpIntentTemplate.setupContext,
            items: followUpIntentTemplate.items,
        });
        assert(createdFollowUpIntent);
        const followUpIntent = await practiceIntentRepository.findPracticeIntent({
            candidatePracticeIntentId: createdFollowUpIntent.candidatePracticeIntentId,
            candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
        });
        assert(followUpIntent);
        const followUpResponse = await handleCandidatePracticeIntentStartRequest({
            request: new Request(`http://localhost/candidate/practice/ready/${followUpIntent.candidatePracticeIntentId}/start`, {
                method: "POST",
            }),
            intentId: followUpIntent.candidatePracticeIntentId,
            now: new Date(runNow.getTime() + 5 * 60_000),
            resolveCandidatePracticeIntentStartIdentity: async () => ({
                candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
            }),
            practiceIntentRepository,
            practiceSessionRepository,
            practiceIntentLaunchRepository,
            createFollowUpSessionInput: createCandidateFollowUpSessionInputFromIntent,
        });
        assert.equal(followUpResponse.status, 303);
        const consumedFollowUpSessionId = readSessionIdFromLocation(followUpResponse.headers.get("location"));
        const followUpSession = await practiceSessionRepository.findSetupSession({
            candidatePracticeSessionId: consumedFollowUpSessionId,
            candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
        });
        assert.equal(followUpSession?.questionWordingSnapshot?.questions.length, 1);
        assert.equal(followUpSession?.questionWordingSnapshot?.questions[0]?.questionText, sourceQuestion.questionText);
        assert.equal(wordingGenerationCallCount, 1);

        const trustedLaunchSessionId = randomUUID();
        const trustedJobDescription = "Verify incoming materials, isolate defects, and record inspection results.";
        const trustedSetupContext = {
            sourcePlatform: "talentarbor" as const,
            jobCollectionId: `reconciliation-job-${uniqueSuffix}`,
            requirementId: `requirement-${uniqueSuffix}`,
            targetRole: `Incoming quality inspector ${uniqueSuffix}`,
            jobDescription: trustedJobDescription,
            jobDescriptionHash: createHash("sha256").update(trustedJobDescription).digest("hex"),
        };
        const trustedIdempotencyKey = `wording-reconciliation-trusted-${randomUUID()}`;
        await insertTrustedLaunchSetup(client, {
            candidateLaunchSessionId: trustedLaunchSessionId,
            trustedSetupContext,
            expiresAt: new Date(runNow.getTime() + 24 * 60 * 60_000),
        });

        const failedResponse = await handleCandidateSetupStartRequest({
            request: createSetupRequest({
                targetRole: trustedSetupContext.targetRole,
                jobDescription: trustedSetupContext.jobDescription,
                setupEntryMode: "trusted_host_job",
                idempotencyKey: trustedIdempotencyKey,
            }),
            now: runNow,
            createSessionId: randomUUID,
            resolveCandidateSetupIdentity: async () => ({
                candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
                candidateLaunchSessionId: trustedLaunchSessionId,
                trustedSetupContext,
                allowManualPrepContextCreation: true,
                allowBrowserBridgeFallback: false,
            }),
            prepContextResolver,
            setupEntryRepository,
            practiceSessionRepository,
            setupStartRequestRepository,
            questionWordingRuntime: createFaultInjectionCandidateQuestionWordingRuntime("provider_unavailable"),
        });
        assert.equal(failedResponse.status, 503);
        const failedBody = await readJsonRecord(failedResponse);
        assert.equal(failedBody.code, "QUESTION_WORDING_PROVIDER_PROVIDER_UNAVAILABLE");
        assert.equal(failedBody.retryable, true);

        const failureFacts = await client.query<{
            practice_session_count: string;
            staging_count: string;
            setup_context_consumed_at: Date | null;
        }>(`
            select
              (select count(*) from public.candidate_practice_sessions where candidate_launch_session_id = $1)::text as practice_session_count,
              (select count(*) from public.candidate_launch_setup_contexts where candidate_launch_session_id = $1)::text as staging_count,
              setup_context_consumed_at
            from public.candidate_launch_sessions
            where candidate_launch_session_id = $1
        `, [trustedLaunchSessionId]);
        assert.equal(failureFacts.rows[0]?.practice_session_count, "0");
        assert.equal(failureFacts.rows[0]?.staging_count, "1");
        assert.equal(failureFacts.rows[0]?.setup_context_consumed_at, null);

        const retriedResponse = await handleCandidateSetupStartRequest({
            request: createSetupRequest({
                targetRole: trustedSetupContext.targetRole,
                jobDescription: trustedSetupContext.jobDescription,
                setupEntryMode: "trusted_host_job",
                idempotencyKey: trustedIdempotencyKey,
            }),
            now: new Date(runNow.getTime() + 3_000),
            createSessionId: randomUUID,
            resolveCandidateSetupIdentity: async () => ({
                candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
                candidateLaunchSessionId: trustedLaunchSessionId,
                trustedSetupContext,
                allowManualPrepContextCreation: true,
                allowBrowserBridgeFallback: false,
            }),
            prepContextResolver,
            setupEntryRepository,
            practiceSessionRepository,
            setupStartRequestRepository,
            questionWordingRuntime: acceptedRuntime,
        });
        assert.equal(retriedResponse.status, 201);
        const retriedBody = await readJsonRecord(retriedResponse);
        assert.equal(typeof retriedBody.sessionId, "string");

        const retryFacts = await client.query<{
            practice_session_count: string;
            staging_count: string;
            setup_context_consumed_at: Date | null;
            claim_generation: number;
            lifecycle_state: string;
        }>(`
            select
              (select count(*) from public.candidate_practice_sessions where candidate_launch_session_id = $1)::text as practice_session_count,
              (select count(*) from public.candidate_launch_setup_contexts where candidate_launch_session_id = $1)::text as staging_count,
              launch.setup_context_consumed_at,
              request.claim_generation,
              request.lifecycle_state
            from public.candidate_launch_sessions launch
            join public.candidate_setup_start_requests request
              on request.candidate_profile_id = launch.candidate_profile_id
             and request.candidate_practice_session_id = $2
            where launch.candidate_launch_session_id = $1
        `, [trustedLaunchSessionId, retriedBody.sessionId]);
        assert.equal(retryFacts.rows[0]?.practice_session_count, "1");
        assert.equal(retryFacts.rows[0]?.staging_count, "0");
        assert(retryFacts.rows[0]?.setup_context_consumed_at);
        assert.equal(retryFacts.rows[0]?.claim_generation, 2);
        assert.equal(retryFacts.rows[0]?.lifecycle_state, "completed");

        process.stdout.write(`${JSON.stringify({
            status: "candidate_question_wording_reconciliation_passed",
            database: "disposable_smoke",
            acceptedGenerationIdentityPersisted: true,
            immutableRecoveryVerified: true,
            acceptedRequestReplayWithoutProvider: true,
            changedRequestConflictBeforeProvider: true,
            failedRequestRetryGeneration: 2,
            followUpSourceWordingReused: true,
            followUpGenerationCallCount: 0,
            providerFailureCreatedSession: false,
            trustedSetupStagingPreserved: true,
            configurationFingerprint: GOOGLE_CANDIDATE_QUESTION_WORDING_CONFIGURATION_FINGERPRINT,
        }, null, 2)}\n`);
    } finally {
        await client.query("rollback").catch(() => undefined);
        client.release();
        await pool.end();
    }
}

function createSetupRequest(input: {
    targetRole: string;
    jobDescription: string;
    setupEntryMode?: "trusted_host_job";
    idempotencyKey: string;
}) {
    return new Request("http://localhost/candidate/setup/start", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "idempotency-key": input.idempotencyKey,
        },
        body: JSON.stringify({
            targetRole: input.targetRole,
            jobDescription: input.jobDescription,
            resumeText: null,
            interviewStage: "screening",
            questionCount: 3,
            ...(input.setupEntryMode ? { setupEntryMode: input.setupEntryMode } : {}),
        }),
    });
}

function createFollowUpIntent(input: {
    sourceSessionId: string;
    roleProfileId: string;
    targetRole: string;
    jobDescription: string;
    sourceQuestion: {
        slotId: string;
        index: number;
        category: string;
        questionText: string;
    };
    now: Date;
}): CandidatePracticeIntentRecord {
    const now = input.now.toISOString();
    return {
        status: "candidate_practice_intent_record",
        candidatePracticeIntentId: randomUUID(),
        candidateProfileId: PRIMARY_CANDIDATE_PROFILE_ID,
        source: "practice_builder",
        lifecycleState: "ready",
        launchVersion: 1,
        consumedCandidatePracticeSessionId: null,
        consumedAt: null,
        roleProfileId: input.roleProfileId,
        targetInterviewId: input.targetRole.toLowerCase(),
        targetRole: input.targetRole,
        itemCount: 1,
        setupContext: {
            targetRole: input.targetRole,
            jobDescription: input.jobDescription,
            interviewStage: "screening",
            questionCount: 3,
            resumeIncluded: false,
        },
        items: [{
            kind: "practice_missing_evidence",
            source: {
                kind: "coach_update_detail",
                candidatePracticeSessionId: input.sourceSessionId,
                questionKey: input.sourceQuestion.slotId,
                targetInterviewId: input.targetRole.toLowerCase(),
                targetRole: input.targetRole,
                questionNumber: input.sourceQuestion.index + 1,
                category: input.sourceQuestion.category,
                questionText: input.sourceQuestion.questionText,
                evidenceStatus: "missing_practice_evidence",
            },
            display: {
                label: "Practice missing evidence",
                body: "Practice the exact saved source question.",
            },
        }],
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(input.now.getTime() + 24 * 60 * 60_000).toISOString(),
    };
}

function readSessionIdFromLocation(location: string | null) {
    assert(location);
    const match = /^\/candidate\/session\/([^?]+)\?entry=1$/.exec(location);
    assert(match?.[1]);
    return decodeURIComponent(match[1]);
}

async function insertTrustedLaunchSetup(client: PoolClient, input: {
    candidateLaunchSessionId: string;
    expiresAt: Date;
    trustedSetupContext: {
        sourcePlatform: "talentarbor";
        jobCollectionId: string;
        requirementId: string;
        targetRole: string;
        jobDescription: string;
        jobDescriptionHash: string;
    };
}) {
    await client.query(`
        insert into public.candidate_launch_sessions (
          candidate_launch_session_id,
          candidate_profile_id,
          provider,
          issuer,
          subject,
          platform_candidate_id,
          job_collection_id,
          source_surface,
          launch_context_snapshot_json,
          expires_at
        ) values ($1, $2, 'talentarbor_launch', 'reconciliation.local', $3, '100001', $4, 'job_detail', '{}'::jsonb, $5)
    `, [
        input.candidateLaunchSessionId,
        PRIMARY_CANDIDATE_PROFILE_ID,
        `candidate:${PRIMARY_CANDIDATE_PROFILE_ID}`,
        input.trustedSetupContext.jobCollectionId,
        input.expiresAt,
    ]);
    await client.query(`
        insert into public.candidate_launch_setup_contexts (
          candidate_launch_session_id,
          candidate_profile_id,
          source_platform,
          job_collection_id,
          requirement_id,
          target_role,
          job_description_snapshot,
          job_description_hash,
          expires_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
        input.candidateLaunchSessionId,
        PRIMARY_CANDIDATE_PROFILE_ID,
        input.trustedSetupContext.sourcePlatform,
        input.trustedSetupContext.jobCollectionId,
        input.trustedSetupContext.requirementId,
        input.trustedSetupContext.targetRole,
        input.trustedSetupContext.jobDescription,
        input.trustedSetupContext.jobDescriptionHash,
        input.expiresAt,
    ]);
}

function createQueryClient(client: PoolClient) {
    return {
        async query(sql: string, values: unknown[]) {
            const result = await client.query<Record<string, unknown>>(sql, values);
            return { rows: result.rows };
        },
    };
}

async function assertSeedCandidateExists(client: PoolClient) {
    const result = await client.query(`
        select candidate_profile_id
        from public.candidate_profiles
        where candidate_profile_id = $1
    `, [PRIMARY_CANDIDATE_PROFILE_ID]);
    assert.equal(result.rowCount, 1, "Seed the disposable candidate database before reconciliation.");
}

async function readJsonRecord(response: Response) {
    const value: unknown = await response.json();
    assert(value && typeof value === "object" && !Array.isArray(value));
    return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${label} must be a nonblank string.`);
    }
    return value;
}

function createAdvancingClock(start: Date) {
    let tick = 0;
    return () => new Date(start.getTime() + tick++ * 25);
}

function readSslConfig(databaseUrl: string) {
    try {
        const sslMode = new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase();
        if (sslMode === "disable") return false;
        if (sslMode) return { rejectUnauthorized: sslMode === "verify-ca" || sslMode === "verify-full" };
    } catch {
        return undefined;
    }
    return undefined;
}

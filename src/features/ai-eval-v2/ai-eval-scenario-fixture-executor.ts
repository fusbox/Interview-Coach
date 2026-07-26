import { createHash } from "node:crypto";

import {
    createCandidateAnswerAnalysisProjectionFromEvaluatorRun,
    type CandidateAnswerAnalysisProviderRequest,
} from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import {
    candidateAnswerAnalysisFixtureRunMetadata,
    runFixtureEvidenceFirstEvaluator,
} from "@/features/candidate-session-v2/candidate-answer-analysis-fixture";
import type {
    CandidateAnswerAttemptRecord,
    CandidateAnswerEvaluationRunRecord,
} from "@/features/candidate-session-v2/candidate-answer-history";
import { createCandidateCompletedRoundReadModels } from "@/features/candidate-session-v2/candidate-completed-round-read-model";
import { createCandidateFeedbackInteraction } from "@/features/candidate-session-v2/candidate-feedback-interaction";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import {
    type CandidateCoachUpdateContent,
    type CandidateCoachUpdateSynthesisInput,
} from "@/features/candidate-dashboard-v2/candidate-coach-update-artifact";
import {
    createFixtureCandidateCoachUpdateRuntime,
    type CandidateCoachUpdateRuntimeMetadata,
    type CandidateCoachUpdateSynthesisRuntimeResult,
} from "@/features/candidate-dashboard-v2/candidate-coach-update-runtime";
import { createCandidateTranscriptCanvasProjection } from "@/features/candidate-dashboard-v2/candidate-transcript-canvas";
import { createInvitedPracticeDebrief } from "@/features/recruiter-invites-v2/invited-practice-debrief";
import type { InvitedPracticeSessionRuntimeRecord } from "@/features/recruiter-invites-v2/invited-practice-session-runtime-repository";
import type { AcceptedEvidenceFirstEvaluatorRun } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";
import {
    evidenceFirstEvaluationCaseSchema,
    type EvidenceFirstEvaluatorConfigurationManifest,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";
import {
    findProhibitedCandidateJudgments,
    findUngroundedTechnicalCoachingClaims,
} from "@/features/evaluation-v2/candidate-generated-language-policy";

import {
    AI_EVAL_SCENARIO_OUTPUT_LAYERS,
    type AiEvalAtomicAnswerScenario,
    type AiEvalRoundJourneyScenario,
    type AiEvalScenario,
    type AiEvalScenarioAssertionResult,
    type AiEvalScenarioOutputLayer,
} from "./ai-eval-scenario-contract";
import { aiEvalScenarioBaselineCases } from "./ai-eval-scenario-baseline";

export type AiEvalScenarioLayerExecution = {
    outputLayer: AiEvalScenarioOutputLayer;
    assertionResult: AiEvalScenarioAssertionResult;
    assertionReasons: string[];
    output: Record<string, unknown>;
    diagnostics: Record<string, unknown> | null;
    errorCode: string | null;
};

export type AiEvalScenarioFixtureExecution = {
    scenarioKey: string;
    layers: AiEvalScenarioLayerExecution[];
};

type AtomicFixture = Awaited<ReturnType<typeof executeAtomicScenario>>;

export type AiEvalScenarioEvaluatorMetadata = {
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    configurationManifest: EvidenceFirstEvaluatorConfigurationManifest;
    configurationFingerprint: string;
};

export type AiEvalScenarioExecutorDependencies = {
    now: () => string;
    evaluateAtomic: (input: {
        scenario: AiEvalAtomicAnswerScenario;
        request: CandidateAnswerAnalysisProviderRequest;
        operationKey: string;
    }) => Promise<{
        acceptedRun: AcceptedEvidenceFirstEvaluatorRun;
        metadata: AiEvalScenarioEvaluatorMetadata;
    }>;
    synthesizeCoachUpdate: (input: {
        synthesisInput: CandidateCoachUpdateSynthesisInput;
        operationKey: string;
    }) => Promise<{
        result: CandidateCoachUpdateSynthesisRuntimeResult;
        metadata: CandidateCoachUpdateRuntimeMetadata;
    }>;
};

export function createAiEvalScenarioFixtureExecutor(input?: {
    scenarioLibrary?: readonly AiEvalScenario[];
}) {
    const coachUpdateRuntime = createFixtureCandidateCoachUpdateRuntime();
    return createAiEvalScenarioExecutor({
        scenarioLibrary: input?.scenarioLibrary,
        dependencies: {
            now: () => "2026-07-22T12:00:00.000Z",
            async evaluateAtomic({ scenario, request }) {
                return {
                    acceptedRun: await runFixtureEvidenceFirstEvaluator(request, {
                        evaluationRunId: `scenario-fixture:${scenario.scenarioKey}`,
                    }),
                    metadata: candidateAnswerAnalysisFixtureRunMetadata,
                };
            },
            async synthesizeCoachUpdate({ synthesisInput }) {
                return {
                    result: await coachUpdateRuntime.synthesize(synthesisInput),
                    metadata: coachUpdateRuntime.metadata,
                };
            },
        },
    });
}

export function createAiEvalScenarioExecutor(input: {
    scenarioLibrary?: readonly AiEvalScenario[];
    dependencies: AiEvalScenarioExecutorDependencies;
}) {
    const scenarioLibrary = new Map(
        [...aiEvalScenarioBaselineCases, ...(input?.scenarioLibrary ?? [])]
            .map((scenario) => [scenario.scenarioKey, scenario]),
    );
    const atomicCache = new Map<string, Promise<AtomicFixture>>();

    const executeAtomic = (scenario: AiEvalAtomicAnswerScenario) => {
        const cached = atomicCache.get(scenario.scenarioKey);
        if (cached) return cached;
        const execution = executeAtomicScenario(scenario, input.dependencies);
        atomicCache.set(scenario.scenarioKey, execution);
        return execution;
    };

    return {
        async execute(scenario: AiEvalScenario): Promise<AiEvalScenarioFixtureExecution> {
            if (scenario.kind === "atomic_answer") {
                const fixture = await executeAtomic(scenario);
                return {
                    scenarioKey: scenario.scenarioKey,
                    layers: scenario.intendedOutputLayers.map((layer) => fixture.layers[layer]),
                };
            }

            const atomicFixtures = await Promise.all(scenario.atomicCaseKeys.map(async (scenarioKey) => {
                const atomicScenario = scenarioLibrary.get(scenarioKey);
                if (atomicScenario?.kind !== "atomic_answer") {
                    throw new Error(`ROUND_JOURNEY_ATOMIC_CASE_MISSING:${scenarioKey}`);
                }
                return executeAtomic(atomicScenario);
            }));
            return {
                scenarioKey: scenario.scenarioKey,
                layers: await createRoundJourneyLayers(scenario, atomicFixtures, input.dependencies),
            };
        },
    };
}

async function executeAtomicScenario(
    scenario: AiEvalAtomicAnswerScenario,
    dependencies: AiEvalScenarioExecutorDependencies,
) {
    const now = dependencies.now();
    const sessionId = stableUuid(`${scenario.scenarioKey}:session`);
    const currentAttemptNumber = scenario.priorAttempts.length + 1;
    const currentTrigger = currentAttemptNumber === 1 ? "initial_submit" : "feedback_retry";
    const answerAttemptId = stableUuid(`${scenario.scenarioKey}:answer:${currentAttemptNumber}`);
    const questionSlotId = scenario.question.lineageKey;
    const request: CandidateAnswerAnalysisProviderRequest = {
        status: "answer_analysis_provider_requested",
        provider: "candidate_v2_answer_evaluator",
        requestedAt: now,
        answer: {
            slotId: questionSlotId,
            questionIndex: 0,
            mode: scenario.answer.mode,
            text: scenario.answer.text,
            submittedAt: now,
            answerAttemptId,
            attemptNumber: currentAttemptNumber,
            trigger: currentTrigger,
        },
        question: {
            slotId: questionSlotId,
            questionIndex: 0,
            category: scenario.question.category,
            questionText: scenario.question.text,
            plannedPurpose: scenario.question.plannedPurpose,
        },
        setupContext: {
            targetRole: scenario.roleContext.targetRole,
            jobDescription: scenario.roleContext.jobDescription,
            resumeText: scenario.roleContext.processedResumeText,
            interviewStage: scenario.roleContext.interviewStage,
            questionCount: 1,
        },
        technicalReference: parseScenarioTechnicalReference(scenario),
        voiceMarkers: scenario.voiceMarkers ?? null,
    };
    const evaluation = await dependencies.evaluateAtomic({
        scenario,
        request,
        operationKey: `answer_evaluation:${scenario.scenarioKey}`,
    });
    const acceptedRun = evaluation.acceptedRun;
    const analysis = createCandidateAnswerAnalysisProjectionFromEvaluatorRun({
        run: acceptedRun,
        answer: {
            slotId: questionSlotId,
            questionIndex: 0,
            answerAttemptId,
            attemptNumber: currentAttemptNumber,
            trigger: currentTrigger,
        },
    });
    const answerAttempt = createAnswerAttemptRecord({
        scenario,
        sessionId,
        answerAttemptId,
        submittedAt: now,
    });
    const evaluationRun = createEvaluationRunRecord({
        acceptedRun,
        answerAttemptId,
        requestedAt: now,
        metadata: evaluation.metadata,
    });
    const priorComparableAttempts = await Promise.all(
        scenario.priorAttempts.map(async (prior, index) => {
            const priorAnswerAttemptId = stableUuid(`${scenario.scenarioKey}:prior:${index}`);
            const submittedAt = new Date(Date.parse(now) - (scenario.priorAttempts.length - index) * 86_400_000)
                .toISOString();
            const priorRequest: CandidateAnswerAnalysisProviderRequest = {
                ...request,
                requestedAt: submittedAt,
                answer: {
                    ...request.answer,
                    mode: prior.answerMode,
                    text: prior.answerText,
                    submittedAt,
                    answerAttemptId: priorAnswerAttemptId,
                    attemptNumber: index + 1,
                    trigger: index === 0 ? "initial_submit" : "feedback_retry",
                },
            };
            const priorEvaluation = await dependencies.evaluateAtomic({
                scenario,
                request: priorRequest,
                operationKey: `answer_evaluation:${scenario.scenarioKey}:prior:${index + 1}`,
            });
            const priorAnalysis = createCandidateAnswerAnalysisProjectionFromEvaluatorRun({
                run: priorEvaluation.acceptedRun,
                answer: {
                    slotId: questionSlotId,
                    questionIndex: 0,
                    answerAttemptId: priorAnswerAttemptId,
                    attemptNumber: index + 1,
                    trigger: index === 0 ? "initial_submit" : "feedback_retry",
                },
            });
            const priorAnswerAttempt: CandidateAnswerAttemptRecord = {
                ...answerAttempt,
                candidateAnswerAttemptId: priorAnswerAttemptId,
                mode: prior.answerMode,
                answerText: prior.answerText,
                submittedAt,
                attemptNumber: index + 1,
                trigger: index === 0 ? "initial_submit" : "feedback_retry",
                supersedesCandidateAnswerAttemptId: index === 0
                    ? null
                    : stableUuid(`${scenario.scenarioKey}:prior:${index - 1}`),
                idempotencyKey: `scenario:${scenario.scenarioKey}:prior:${index + 1}`,
                payloadFingerprint: hash({
                    answerText: prior.answerText,
                    answerMode: prior.answerMode,
                }),
            };
            return {
                answerAttempt: priorAnswerAttempt,
                acceptedEvaluationRun: createEvaluationRunRecord({
                    acceptedRun: priorEvaluation.acceptedRun,
                    answerAttemptId: priorAnswerAttemptId,
                    requestedAt: submittedAt,
                    metadata: priorEvaluation.metadata,
                }),
                acceptedAnalysis: priorAnalysis,
            };
        }),
    );
    const transcriptCanvas = createCandidateTranscriptCanvasProjection({
        acceptedRun,
        evaluation: {
            evaluationRunId: acceptedRun.evaluationRunId,
            answerAttemptId,
            inputFingerprint: acceptedRun.inputFingerprint,
        },
        answerAttempt,
    });
    const session = createCompletedCandidateSession({ scenario, sessionId, answerAttemptId, analysis, now });
    const completedRound = createCandidateCompletedRoundReadModels(session);
    if (!completedRound) throw new Error("FIXTURE_CANDIDATE_ROUND_PROJECTION_FAILED");
    const invitedDebrief = createInvitedPracticeDebrief(
        createCompletedInvitedSession({ scenario, sessionId, answerAttemptId, analysis, now }),
        1,
    );
    if (!invitedDebrief) throw new Error("FIXTURE_INVITED_SUMMARY_PROJECTION_FAILED");
    const coachUpdateInput = createCoachUpdateInput({
        scenario,
        sessionId,
        answerAttempt,
        evaluationRun,
        analysis,
        transcriptCanvas,
        acceptedRun,
        priorComparableAttempts,
        now,
    });
    const sessionCoaching = createCandidateFeedbackInteraction({
        analysisSnapshot: analysis,
        isLastQuestion: true,
    });
    let coachUpdateSynthesis: Awaited<ReturnType<AiEvalScenarioExecutorDependencies["synthesizeCoachUpdate"]>> | null = null;
    let coachUpdate: CandidateCoachUpdateContent | null = null;
    let coachUpdateErrorCode: string | null = null;
    try {
        coachUpdateSynthesis = await dependencies.synthesizeCoachUpdate({
            synthesisInput: coachUpdateInput,
            operationKey: `coach_update:atomic:${scenario.scenarioKey}`,
        });
        coachUpdate = coachUpdateSynthesis.result.content;
    } catch (error) {
        coachUpdateErrorCode = safeLayerErrorCode(error);
    }
    const contractAssertions = assertAtomicContract({
        scenario,
        acceptedRun,
        sessionCoaching,
        transcriptCanvas,
        coachUpdate,
        invitedDebrief,
        completedRound,
    });

    const layers: Record<AiEvalScenarioOutputLayer, AiEvalScenarioLayerExecution> = {
        evaluator_diagnostics: layer(
            "evaluator_diagnostics",
            contractAssertions.hardFailures.length > 0 ? "fail" : "pass",
            contractAssertions.hardFailures,
            {
                status: acceptedRun.status,
                inputFingerprint: acceptedRun.inputFingerprint,
                answerUsability: acceptedRun.accepted.extraction.answerUsability,
                observableMarkers: acceptedRun.accepted.extraction.observableMarkers,
                categorySignals: acceptedRun.accepted.extraction.categorySignals,
                sensitiveContentFlags: acceptedRun.accepted.extraction.sensitiveContentFlags,
                technicalAccuracy: acceptedRun.accepted.extraction.technicalAccuracy,
                criteria: acceptedRun.accepted.criteria,
                patternGap: acceptedRun.accepted.patternGap,
                verification: acceptedRun.accepted.verification,
                feedbackPlan: acceptedRun.accepted.feedback.feedbackPlan,
            },
            {
                profileId: acceptedRun.profile.profileId,
                contractVersion: acceptedRun.contractVersion,
                stageOutcomes: acceptedRun.stages.map((stage) => ({
                    stage: stage.stage,
                    outcome: stage.outcome,
                })),
                evaluatorMetrics: acceptedRun.metrics,
                coachUpdateMetrics: coachUpdateSynthesis?.result.validation ?? null,
                coachUpdateProfileId: coachUpdateSynthesis?.metadata.profileId ?? null,
                coachUpdateErrorCode,
                rawProviderOutputStored: false,
                assembledPromptStored: false,
            },
        ),
        session_coaching: reviewLayer("session_coaching", sessionCoaching, contractAssertions.reviewReasons),
        transcript_evidence: reviewLayer("transcript_evidence", {
            status: transcriptCanvas ? "annotated" : "plain_transcript_fallback",
            projection: transcriptCanvas,
            fallbackReason: transcriptCanvas ? null : "No safe exact-span annotation was admitted.",
        }, contractAssertions.reviewReasons),
        coach_update: coachUpdate
            ? reviewLayer("coach_update", coachUpdate, contractAssertions.reviewReasons)
            : failedLayer("coach_update", coachUpdateErrorCode ?? "COACH_UPDATE_SYNTHESIS_FAILED"),
        invited_completion: reviewLayer("invited_completion", invitedDebrief, contractAssertions.reviewReasons),
        candidate_dashboard: reviewLayer("candidate_dashboard", {
            dashboardUpdate: completedRound.dashboardUpdate,
            postRoundReview: completedRound.postRoundReview,
            practiceNext: completedRound.practiceNext,
        }, contractAssertions.reviewReasons),
    };
    return {
        layers,
        analysis,
        acceptedRun,
        answerAttempt,
        evaluationRun,
        transcriptCanvas,
        coachUpdateInput,
        invitedDebrief,
        completedRound,
    };
}

async function createRoundJourneyLayers(
    scenario: AiEvalRoundJourneyScenario,
    atomicFixtures: AtomicFixture[],
    dependencies: AiEvalScenarioExecutorDependencies,
): Promise<AiEvalScenarioLayerExecution[]> {
    const now = dependencies.now();
    const synthesisInput = createRoundCoachUpdateInput(scenario, atomicFixtures, now);
    let coachUpdateSynthesis: Awaited<ReturnType<AiEvalScenarioExecutorDependencies["synthesizeCoachUpdate"]>> | null = null;
    let coachUpdate: CandidateCoachUpdateContent | null = null;
    let coachUpdateErrorCode: string | null = null;
    try {
        coachUpdateSynthesis = await dependencies.synthesizeCoachUpdate({
            synthesisInput,
            operationKey: `coach_update:journey:${scenario.scenarioKey}`,
        });
        coachUpdate = coachUpdateSynthesis.result.content;
    } catch (error) {
        coachUpdateErrorCode = safeLayerErrorCode(error);
    }
    const invited = atomicFixtures.map((fixture) => fixture.layers.invited_completion.output);
    const dashboards = atomicFixtures.map((fixture) => fixture.layers.candidate_dashboard.output);
    const coachUpdateText = coachUpdate ? collectGeneratedCandidateText({ coachUpdate }).join("\n").toLowerCase() : "";
    const sourceText = atomicFixtures.map((fixture) => fixture.answerAttempt.answerText).join("\n").toLowerCase();
    const hardFailures = coachUpdate
        ? [
            ...scenario.expected.requiredCoachUpdateConcepts
                .filter((concept) => !coachUpdateText.includes(concept.toLowerCase()))
                .map((concept) => `Required Coach Update concept was missing: ${concept}.`),
            ...scenario.expected.forbiddenCoachUpdateConcepts
                .filter((concept) => (
                    !sourceText.includes(concept.toLowerCase())
                    && coachUpdateText.includes(concept.toLowerCase())
                ))
                .map((concept) => `Forbidden Coach Update concept was present in app-authored coaching: ${concept}.`),
            ...findProhibitedCandidateJudgments(collectGeneratedCandidateText({ coachUpdate }), {
                sourceTexts: atomicFixtures.flatMap((fixture) => [
                    fixture.answerAttempt.answerText,
                    fixture.coachUpdateInput.questions[0]?.questionText ?? "",
                ]),
            })
                .map((judgment) => `App-authored Coach Update used prohibited judgment language: ${judgment.ruleId}.`),
            ...assertRoundCoachUpdateSemantics({
                scenario,
                synthesisInput,
                coachUpdate,
            }),
        ]
        : [];
    const reviewReasons = [
        ...hardFailures,
        coachUpdate
            ? "Round-level progression language and teaching priority require operator review."
            : "Round Coach Update was unavailable; retained downstream evidence still requires operator review.",
        `Expected progression posture: ${scenario.expected.progression}.`,
    ];
    const outputs: Partial<Record<AiEvalScenarioOutputLayer, Record<string, unknown>>> = {
        ...(coachUpdate
            ? {
                coach_update: {
                    status: "scenario_round_coach_update_v1",
                    targetRole: scenario.targetRole,
                    posture: scenario.posture,
                    content: coachUpdate,
                },
            }
            : {}),
        invited_completion: {
            status: "scenario_round_invited_completion_v1",
            targetRole: scenario.targetRole,
            questionCount: invited.length,
            questionSummaries: invited,
        },
        candidate_dashboard: {
            status: "scenario_round_candidate_dashboard_v1",
            targetRole: scenario.targetRole,
            coachUpdate,
            coachUpdateState: coachUpdate ? "ready" : "unavailable",
            atomicDashboardProjections: dashboards,
        },
    };
    return scenario.intendedOutputLayers.map((outputLayer) => {
        if (outputLayer === "coach_update" && !coachUpdate) {
            return failedLayer("coach_update", coachUpdateErrorCode ?? "COACH_UPDATE_SYNTHESIS_FAILED");
        }
        const output = outputs[outputLayer];
        if (!output) throw new Error(`ROUND_JOURNEY_LAYER_UNSUPPORTED:${outputLayer}`);
        return layer(outputLayer, hardFailures.length ? "fail" : "review_required", reviewReasons, output, outputLayer === "coach_update" ? {
            coachUpdateMetrics: coachUpdateSynthesis?.result.validation ?? null,
            coachUpdateProfileId: coachUpdateSynthesis?.metadata.profileId ?? null,
            rawProviderOutputStored: false,
            assembledPromptStored: false,
        } : null);
    });
}

function createAnswerAttemptRecord(input: {
    scenario: AiEvalAtomicAnswerScenario;
    sessionId: string;
    answerAttemptId: string;
    submittedAt: string;
}): CandidateAnswerAttemptRecord {
    return {
        candidateAnswerAttemptId: input.answerAttemptId,
        candidatePracticeSessionId: input.sessionId,
        candidateProfileId: stableUuid(`${input.scenario.scenarioKey}:candidate`),
        questionSlotId: input.scenario.question.lineageKey,
        questionIndex: 0,
        attemptNumber: input.scenario.priorAttempts.length + 1,
        trigger: input.scenario.priorAttempts.length === 0 ? "initial_submit" : "feedback_retry",
        supersedesCandidateAnswerAttemptId: input.scenario.priorAttempts.length === 0
            ? null
            : stableUuid(`${input.scenario.scenarioKey}:prior:${input.scenario.priorAttempts.length - 1}`),
        mode: input.scenario.answer.mode,
        answerText: input.scenario.answer.text,
        submittedAt: input.submittedAt,
        idempotencyKey: `scenario:${input.scenario.scenarioKey}:answer:${input.scenario.priorAttempts.length + 1}`,
        payloadFingerprint: hash(input.scenario.answer),
        sourceVoiceTranscriptionRunId: input.scenario.answer.mode === "voice"
            ? stableUuid(`${input.scenario.scenarioKey}:transcription`)
            : null,
        voiceSubmissionPath: input.scenario.answer.mode === "voice" ? "quick_submit" : null,
        voiceTranscriptEdited: input.scenario.answer.mode === "voice" ? false : null,
        createdAt: input.submittedAt,
    };
}

function createEvaluationRunRecord(input: {
    acceptedRun: AcceptedEvidenceFirstEvaluatorRun;
    answerAttemptId: string;
    requestedAt: string;
    metadata: AiEvalScenarioEvaluatorMetadata;
}): CandidateAnswerEvaluationRunRecord {
    return {
        candidateAnswerEvaluationRunId: input.acceptedRun.evaluationRunId,
        candidateAnswerAttemptId: input.answerAttemptId,
        purpose: "candidate_coaching",
        provider: input.metadata.provider,
        modelName: input.metadata.modelName,
        promptVersion: input.metadata.promptVersion,
        evaluatorVersion: input.metadata.evaluatorVersion,
        configurationManifest: input.metadata.configurationManifest,
        configurationFingerprint: input.metadata.configurationFingerprint,
        inputFingerprint: input.acceptedRun.inputFingerprint,
        idempotencyKey: `scenario:${input.acceptedRun.evaluationRunId}`,
        generationAttempt: 1,
        lifecycleState: "completed",
        result: input.acceptedRun,
        validation: { accepted: true },
        errorCode: null,
        requestedAt: input.requestedAt,
        claimExpiresAt: input.acceptedRun.completedAt,
        completedAt: input.acceptedRun.completedAt,
        createdAt: input.requestedAt,
        updatedAt: input.acceptedRun.completedAt,
    };
}

function createCoachUpdateInput(input: {
    scenario: AiEvalAtomicAnswerScenario;
    sessionId: string;
    answerAttempt: CandidateAnswerAttemptRecord;
    evaluationRun: CandidateAnswerEvaluationRunRecord;
    analysis: ReturnType<typeof createCandidateAnswerAnalysisProjectionFromEvaluatorRun>;
    transcriptCanvas: ReturnType<typeof createCandidateTranscriptCanvasProjection>;
    acceptedRun: AcceptedEvidenceFirstEvaluatorRun;
    priorComparableAttempts: CandidateCoachUpdateSynthesisInput["questions"][number]["priorComparableAttempts"];
    now: string;
}): CandidateCoachUpdateSynthesisInput {
    return {
        status: "candidate_coach_update_synthesis_input_v1",
        candidateProfileId: input.answerAttempt.candidateProfileId,
        roleProfileId: stableUuid(`${input.scenario.scenarioKey}:role`),
        sourceCandidatePracticeSessionId: input.sessionId,
        targetRole: input.scenario.roleContext.targetRole,
        completedAt: input.now,
        questionCount: 1,
        answeredCount: 1,
        sourceCompletionFingerprint: hash({ scenario: input.scenario.scenarioKey, completion: input.now }),
        synthesisInputFingerprint: hash({ scenario: input.scenario.scenarioKey, run: input.acceptedRun.inputFingerprint }),
        questions: [{
            questionKey: input.scenario.question.lineageKey,
            questionNumber: 1,
            category: input.scenario.question.category,
            questionText: input.scenario.question.text,
            answerAttempt: input.answerAttempt,
            acceptedEvaluationRun: input.evaluationRun,
            acceptedAnalysis: input.analysis,
            transcriptCanvas: input.transcriptCanvas,
            source: {
                candidatePracticeSessionId: input.sessionId,
                questionKey: input.scenario.question.lineageKey,
            },
            priorComparableAttempts: input.priorComparableAttempts,
        }],
    };
}

function createRoundCoachUpdateInput(
    scenario: AiEvalRoundJourneyScenario,
    atomicFixtures: AtomicFixture[],
    now: string,
): CandidateCoachUpdateSynthesisInput {
    const questions = atomicFixtures.map((fixture, index) => {
        const question = fixture.coachUpdateInput.questions[0];
        if (!question) throw new Error("ROUND_JOURNEY_COACH_UPDATE_QUESTION_MISSING");
        return { ...question, questionNumber: index + 1 };
    });
    return {
        status: "candidate_coach_update_synthesis_input_v1",
        candidateProfileId: stableUuid(`${scenario.scenarioKey}:candidate`),
        roleProfileId: stableUuid(`${scenario.scenarioKey}:role`),
        sourceCandidatePracticeSessionId: stableUuid(`${scenario.scenarioKey}:session`),
        targetRole: scenario.targetRole,
        completedAt: now,
        questionCount: questions.length,
        answeredCount: questions.length,
        sourceCompletionFingerprint: hash({ scenario: scenario.scenarioKey, completion: now }),
        synthesisInputFingerprint: hash({
            scenario: scenario.scenarioKey,
            evaluations: atomicFixtures.map((fixture) => fixture.acceptedRun.inputFingerprint),
        }),
        questions,
    };
}

function createCompletedCandidateSession(input: {
    scenario: AiEvalAtomicAnswerScenario;
    sessionId: string;
    answerAttemptId: string;
    analysis: ReturnType<typeof createCandidateAnswerAnalysisProjectionFromEvaluatorRun>;
    now: string;
}): CandidatePracticeSessionRecord {
    const common = createCompletedSessionCommon(input);
    return {
        candidatePracticeSessionId: input.sessionId,
        candidateProfileId: stableUuid(`${input.scenario.scenarioKey}:candidate`),
        roleProfileId: stableUuid(`${input.scenario.scenarioKey}:role`),
        candidateLaunchSessionId: null,
        status: "completed",
        ...common,
        questionWordingStatus: "worded",
        completionSnapshot: {
            status: "candidate_session_completed",
            audience: "candidate_led",
            sessionId: input.sessionId,
            completedAt: input.now,
            finalProgress: { status: "completed", currentQuestionIndex: 0 },
            questionCount: 1,
            answeredCount: 1,
            coachedCount: 1,
            answeredQuestionKeys: [input.scenario.question.lineageKey],
            coachedQuestionKeys: [input.scenario.question.lineageKey],
            skippedOrUnansweredQuestionKeys: [],
            nextRoute: `/candidate/dashboard?prep=${stableUuid(`${input.scenario.scenarioKey}:role`)}`,
        },
    };
}

function createCompletedInvitedSession(input: {
    scenario: AiEvalAtomicAnswerScenario;
    sessionId: string;
    answerAttemptId: string;
    analysis: ReturnType<typeof createCandidateAnswerAnalysisProjectionFromEvaluatorRun>;
    now: string;
}): InvitedPracticeSessionRuntimeRecord {
    const common = createCompletedSessionCommon(input);
    return {
        invitedPracticeSessionId: input.sessionId,
        recruiterInvitationRecipientId: stableUuid(`${input.scenario.scenarioKey}:recipient`),
        recruiterId: stableUuid(`${input.scenario.scenarioKey}:recruiter`),
        status: "completed",
        ...common,
        completionSnapshot: {
            status: "invited_session_completed",
            audience: "invited_candidate",
            sessionId: input.sessionId,
            completedAt: input.now,
            finalProgress: { status: "completed", currentQuestionIndex: 0 },
            questionCount: 1,
            answeredCount: 1,
            coachedCount: 1,
            answeredQuestionKeys: [input.scenario.question.lineageKey],
            coachedQuestionKeys: [input.scenario.question.lineageKey],
            skippedOrUnansweredQuestionKeys: [],
            nextRoute: "/candidate/invited",
        },
    };
}

function createCompletedSessionCommon(input: {
    scenario: AiEvalAtomicAnswerScenario;
    answerAttemptId: string;
    analysis: ReturnType<typeof createCandidateAnswerAnalysisProjectionFromEvaluatorRun>;
    now: string;
}) {
    const slotId = input.scenario.question.lineageKey;
    const questionPlanSnapshot: CandidateQuestionPlan = {
        interviewStage: input.scenario.roleContext.interviewStage,
        questionCount: 1,
        categoryCounts: {
            screening: input.scenario.question.category === "screening" ? 1 : 0,
            behavioral: input.scenario.question.category === "behavioral" ? 1 : 0,
            culture_fit: input.scenario.question.category === "culture_fit" ? 1 : 0,
            case_scenario: input.scenario.question.category === "case_scenario" ? 1 : 0,
            technical_role_specific: input.scenario.question.category === "technical_role_specific" ? 1 : 0,
        },
        slots: [{
            id: slotId,
            index: 0,
            category: input.scenario.question.category,
            label: input.scenario.question.category,
            purpose: input.scenario.question.plannedPurpose,
        }],
    };
    return {
        setupSnapshot: {
            targetRole: input.scenario.roleContext.targetRole,
            jobDescription: input.scenario.roleContext.jobDescription,
            resumeText: input.scenario.roleContext.processedResumeText,
            interviewStage: input.scenario.roleContext.interviewStage,
            questionCount: 1,
            resumeCaptureMode: input.scenario.roleContext.processedResumeText ? "pasted_text" as const : "none" as const,
            createdAt: input.now,
        },
        questionPlanSnapshot,
        questionWordingSnapshot: {
            status: "questions_worded" as const,
            questions: [{
                slotId,
                index: 0,
                category: input.scenario.question.category,
                questionText: input.scenario.question.text,
            }],
        },
        progress: { status: "completed" as const, currentQuestionIndex: 0 },
        answerDrafts: {},
        answerSubmissions: {
            [slotId]: {
                slotId,
                questionIndex: 0,
                mode: input.scenario.answer.mode,
                text: input.scenario.answer.text,
                submittedAt: input.now,
                status: "pending_analysis" as const,
                answerAttemptId: input.answerAttemptId,
                attemptNumber: 1,
                trigger: "initial_submit" as const,
            },
        },
        answerIdempotencyRecords: {},
        answerAnalysisSnapshots: { [slotId]: input.analysis },
        feedbackActionEvents: {},
        voiceTranscriptDrafts: {},
    };
}

function assertAtomicContract(input: {
    scenario: AiEvalAtomicAnswerScenario;
    acceptedRun: AcceptedEvidenceFirstEvaluatorRun;
    sessionCoaching: ReturnType<typeof createCandidateFeedbackInteraction>;
    transcriptCanvas: ReturnType<typeof createCandidateTranscriptCanvasProjection>;
    coachUpdate: CandidateCoachUpdateContent | null;
    invitedDebrief: NonNullable<ReturnType<typeof createInvitedPracticeDebrief>>;
    completedRound: NonNullable<ReturnType<typeof createCandidateCompletedRoundReadModels>>;
}) {
    const hardFailures: string[] = [];
    if (input.acceptedRun.retention.assembledPrompt !== "not_captured") {
        hardFailures.push("The fixture run captured an assembled prompt.");
    }
    if (input.acceptedRun.retention.rawProviderOutput !== "not_captured") {
        hardFailures.push("The fixture run captured raw provider output.");
    }
    if (input.transcriptCanvas && input.transcriptCanvas.inputFingerprint !== input.acceptedRun.inputFingerprint) {
        hardFailures.push("Transcript evidence drifted from the accepted evaluator input fingerprint.");
    }
    if ((input.coachUpdate && input.coachUpdate.questions.length !== 1) || input.invitedDebrief.questions.length !== 1) {
        hardFailures.push("Candidate-visible projections did not preserve the one-question fixture boundary.");
    }
    if (input.completedRound.postRoundReview.questions[0]?.answer?.text !== input.scenario.answer.text) {
        hardFailures.push("The completed-round projection did not preserve the exact synthetic response.");
    }
    const extraction = input.acceptedRun.accepted.extraction;
    const expected = input.scenario.expected;
    if (!expected.allowedUsability.includes(extraction.answerUsability.status)) {
        hardFailures.push(`Answer usability was ${extraction.answerUsability.status}; expected ${expected.allowedUsability.join(" or ")}.`);
    }
    for (const [marker, expectedValue] of Object.entries(expected.markerValues)) {
        const actual = extraction.observableMarkers[marker as keyof typeof extraction.observableMarkers];
        if (actual !== expectedValue) hardFailures.push(`Observable marker ${marker} was ${String(actual)}; expected ${String(expectedValue)}.`);
    }
    for (const [signalId, allowedStatuses] of Object.entries(expected.categorySignalStatuses)) {
        const actual = extraction.categorySignals.find((signal) => signal.id === signalId)?.status ?? "missing";
        if (!allowedStatuses.includes(actual as never)) {
            hardFailures.push(`Category signal ${signalId} was ${actual}; expected ${allowedStatuses.join(" or ")}.`);
        }
    }
    for (const flag of expected.requiredSensitiveFlags) {
        if (!extraction.sensitiveContentFlags.includes(flag as never)) {
            hardFailures.push(`Required sensitive-content flag ${flag} was missing.`);
        }
    }
    if (expected.technicalAccuracy) {
        const matches = expected.technicalAccuracy === "assessed"
            ? extraction.technicalAccuracy.status !== "not_assessed"
            : extraction.technicalAccuracy.status === expected.technicalAccuracy;
        if (!matches) {
            hardFailures.push(`Technical accuracy was ${extraction.technicalAccuracy.status}; expected ${expected.technicalAccuracy}.`);
        }
    }
    if (expected.verificationRequired !== null && input.acceptedRun.accepted.verification.required !== expected.verificationRequired) {
        hardFailures.push(`Technical verification requirement was ${String(input.acceptedRun.accepted.verification.required)}; expected ${String(expected.verificationRequired)}.`);
    }
    const intervention = input.acceptedRun.accepted.feedback.feedbackPlan.intervention;
    if (expected.allowedInterventions.length && !expected.allowedInterventions.includes(intervention)) {
        hardFailures.push(`Feedback intervention was ${intervention}; expected ${expected.allowedInterventions.join(" or ")}.`);
    }
    if (expected.allowedPatternGapIds.length && !expected.allowedPatternGapIds.includes(input.acceptedRun.accepted.patternGap.id)) {
        hardFailures.push(`Pattern gap was ${input.acceptedRun.accepted.patternGap.id}; expected ${expected.allowedPatternGapIds.join(" or ")}.`);
    }
    for (const [criterionId, criterionExpectation] of Object.entries(expected.criterionAppraisals)) {
        const criterion = input.acceptedRun.accepted.criteria.find((item) => item.criterionId === criterionId);
        if (!criterion || !criterionExpectation.allowedApplicability.includes(criterion.applicability)) {
            hardFailures.push(`Criterion ${criterionId} applicability was ${criterion?.applicability ?? "missing"}; expected ${criterionExpectation.allowedApplicability.join(" or ")}.`);
            continue;
        }
        if (criterion.applicability === "observed" && criterionExpectation.allowedBands
            && (!criterion.band || !criterionExpectation.allowedBands.includes(criterion.band))) {
            hardFailures.push(`Criterion ${criterionId} band was ${criterion.band ?? "missing"}; expected ${criterionExpectation.allowedBands.join(" or ")}.`);
        }
    }
    const projection = input.acceptedRun.accepted.candidateProjection;
    if (expected.primaryStrength !== null && Boolean(projection.primaryStrength) !== (expected.primaryStrength === "present")) {
        hardFailures.push(`Candidate primary strength was ${projection.primaryStrength ? "present" : "absent"}; expected ${expected.primaryStrength}.`);
    }
    if (expected.deliveryNote !== null && Boolean(projection.deliveryNote) !== (expected.deliveryNote === "present")) {
        hardFailures.push(`Candidate delivery note was ${projection.deliveryNote ? "present" : "absent"}; expected ${expected.deliveryNote}.`);
    }
    const generatedCandidateText = collectGeneratedCandidateText({
        sessionCoaching: input.sessionCoaching,
        coachUpdate: input.coachUpdate,
        invitedDebrief: input.invitedDebrief,
        completedRound: input.completedRound,
    });
    const candidateText = generatedCandidateText.join("\n").toLowerCase();
    const sourceText = input.scenario.answer.text.toLowerCase();
    for (const concept of expected.requiredCoachingConcepts) {
        if (!candidateText.includes(concept.toLowerCase())) hardFailures.push(`Required coaching concept was missing: ${concept}.`);
    }
    for (const concept of expected.forbiddenCoachingConcepts) {
        if (
            !sourceText.includes(concept.toLowerCase())
            && candidateText.includes(concept.toLowerCase())
        ) {
            hardFailures.push(`Forbidden coaching concept was present in app-authored coaching: ${concept}.`);
        }
    }
    for (const judgment of findProhibitedCandidateJudgments(generatedCandidateText, {
        sourceTexts: [input.scenario.question.text, input.scenario.answer.text],
    })) {
        hardFailures.push(`App-authored coaching used prohibited judgment language: ${judgment.ruleId}.`);
    }
    if (
        input.scenario.question.category === "technical_role_specific"
        && extraction.technicalAccuracy.status === "not_assessed"
    ) {
        for (const claim of findUngroundedTechnicalCoachingClaims(generatedCandidateText)) {
            hardFailures.push(`Unreferenced technical coaching crossed its grounding boundary: ${claim.ruleId}.`);
        }
    }
    return {
        hardFailures,
        reviewReasons: hardFailures.length > 0
            ? hardFailures
            : ["Contract checks passed; operator review is required for naturalness and teaching usefulness."],
    };
}

function assertRoundCoachUpdateSemantics(input: {
    scenario: AiEvalRoundJourneyScenario;
    synthesisInput: CandidateCoachUpdateSynthesisInput;
    coachUpdate: CandidateCoachUpdateContent;
}) {
    const failures: string[] = [];
    const comparisonText = input.coachUpdate.questions
        .map((question) => question.comparison.message)
        .join(" ");
    if (input.scenario.expected.progression === "improved") {
        if (!/\b(?:improv|clearer|stronger|more specific|more complete|added|developed|now includes?)\w*\b/i.test(comparisonText)) {
            failures.push("Improved repeat practice did not acknowledge the supported progression.");
        }
        if (/\b(?:remains? consistent|stayed the same|no meaningful change|unchanged)\b/i.test(comparisonText)) {
            failures.push("Improved repeat practice was incorrectly described as stable or unchanged.");
        }
    }

    const usabilityStatuses = input.synthesisInput.questions
        .map((question) => question.acceptedAnalysis.evidenceFirst.appraisal.answerUsability.status);
    if (
        usabilityStatuses.some((status) => status !== "usable")
        && /\b(?:each|every|all)\b.{0,80}\b(?:answer|response|experience)\w*\b.{0,80}\b(?:show|share|demonstrate|include|provide|connect)\w*\b/i
            .test(input.coachUpdate.summary)
    ) {
        failures.push("The round summary promoted a shared strength across thin, generic, or unusable evidence.");
    }

    const technicalStatuses = input.synthesisInput.questions
        .filter((question) => (
            question.category === "technical_role_specific"
            || question.category === "Technical / Role-Specific"
        ))
        .map((question) => question.acceptedAnalysis.evidenceFirst.appraisal.technicalAccuracy.status);
    const technicalStatusSet = new Set(technicalStatuses);
    if (
        technicalStatusSet.has("supported")
        && technicalStatusSet.has("contradicted")
        && technicalStatusSet.has("not_assessed")
    ) {
        const technicalText = [
            input.coachUpdate.summary,
            input.coachUpdate.primaryFocus,
            ...input.coachUpdate.questions.map((question) => question.comparison.message),
        ].join(" ");
        if (!/\b(?:support|confirm|match|ground)\w*\b/i.test(technicalText)) {
            failures.push("The mixed technical round did not preserve its supported evidence.");
        }
        if (!/\b(?:contradict|correct|revision|revise|did not match|does not match)\w*\b/i.test(technicalText)) {
            failures.push("The mixed technical round did not preserve its contradicted evidence.");
        }
    }
    return failures;
}

function layer(
    outputLayer: AiEvalScenarioOutputLayer,
    assertionResult: AiEvalScenarioAssertionResult,
    assertionReasons: string[],
    output: Record<string, unknown>,
    diagnostics: Record<string, unknown> | null,
): AiEvalScenarioLayerExecution {
    return { outputLayer, assertionResult, assertionReasons, output, diagnostics, errorCode: null };
}

function reviewLayer(
    outputLayer: AiEvalScenarioOutputLayer,
    output: Record<string, unknown>,
    reasons: string[],
) {
    return layer(outputLayer, "review_required", reasons, output, null);
}

function failedLayer(
    outputLayer: AiEvalScenarioOutputLayer,
    errorCode: string,
): AiEvalScenarioLayerExecution {
    return {
        outputLayer,
        assertionResult: "fail",
        assertionReasons: [`${outputLayer} could not be produced: ${errorCode}.`],
        output: {
            status: "scenario_output_layer_unavailable",
            errorCode,
        },
        diagnostics: null,
        errorCode,
    };
}

function collectGeneratedCandidateText(input: {
    sessionCoaching?: ReturnType<typeof createCandidateFeedbackInteraction> | null;
    coachUpdate?: CandidateCoachUpdateContent | null;
    invitedDebrief?: NonNullable<ReturnType<typeof createInvitedPracticeDebrief>> | null;
    completedRound?: NonNullable<ReturnType<typeof createCandidateCompletedRoundReadModels>> | null;
}) {
    const values: string[] = [];
    for (const stage of input.sessionCoaching?.stages ?? []) {
        values.push(stage.label, stage.title, stage.body);
        for (const guidance of stage.guidance ?? []) {
            values.push(guidance.label, guidance.body, ...(guidance.steps ?? []));
        }
        values.push(...stage.actions.map((action) => action.label));
    }
    values.push(...(input.sessionCoaching?.globalActions ?? []).map((action) => action.label));

    const coachUpdate = input.coachUpdate;
    if (coachUpdate) {
        values.push(coachUpdate.title, coachUpdate.summary, coachUpdate.primaryFocus);
        for (const question of coachUpdate.questions) {
            values.push(
                question.coaching.acknowledgement,
                question.coaching.observation,
                question.coaching.nextPracticeFocus,
                question.comparison.message,
            );
        }
    }

    for (const question of input.invitedDebrief?.questions ?? []) {
        if (question.coaching) {
            values.push(
                question.coaching.acknowledgement,
                question.coaching.observation,
                question.coaching.nextPracticeFocus,
            );
        }
    }

    const completedRound = input.completedRound;
    if (completedRound) {
        values.push(
            completedRound.dashboardUpdate.title,
            completedRound.dashboardUpdate.body,
            completedRound.practiceNext.label,
            completedRound.practiceNext.reason,
        );
        const preview = completedRound.dashboardUpdate.coachingPreview;
        if (preview) values.push(preview.observation, preview.nextPracticeFocus);
        for (const question of completedRound.postRoundReview.questions) {
            if (question.coaching) {
                values.push(
                    question.coaching.acknowledgement,
                    question.coaching.observation,
                    question.coaching.nextPracticeFocus,
                );
            }
        }
    }

    return values.filter((value) => value.trim().length > 0);
}

function parseScenarioTechnicalReference(
    scenario: AiEvalAtomicAnswerScenario,
): CandidateAnswerAnalysisProviderRequest["technicalReference"] {
    const rawReference = scenario.technicalReference?.trim();
    if (!rawReference) return null;

    try {
        const parsed = evidenceFirstEvaluationCaseSchema.shape.providerInput.shape.technicalReference
            .safeParse(JSON.parse(rawReference));
        if (parsed.success && parsed.data) return parsed.data;
    } catch {
        // Supplemental operator-authored references are accepted as plain text.
    }

    return {
        source: "domain_reference",
        version: `scenario_${scenario.scenarioKey}_v1`,
        expectedConcepts: [{
            id: "scenario_reference",
            description: rawReference.slice(0, 2_000),
        }],
        acceptableAlternatives: [],
        commonMisconceptions: [],
    };
}

function safeLayerErrorCode(error: unknown) {
    const message = error instanceof Error ? error.message : "SCENARIO_OUTPUT_LAYER_FAILED";
    const candidate = message.split(":", 1)[0]?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_") ?? "";
    return /^[A-Z][A-Z0-9_]{0,79}$/.test(candidate) ? candidate : "SCENARIO_OUTPUT_LAYER_FAILED";
}

function stableUuid(value: string) {
    const hex = createHash("sha256").update(value).digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function getAllScenarioOutputLayers() {
    return [...AI_EVAL_SCENARIO_OUTPUT_LAYERS];
}

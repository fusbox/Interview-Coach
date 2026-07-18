import { createHash } from "node:crypto";

import {
    createCandidateAnswerAnalysisProjectionFromEvaluatorRun,
    type CandidateAnswerAnalysisProviderResult,
} from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import type {
    CandidateAnswerAttemptRecord,
    CandidateAnswerEvaluationRunRecord,
} from "@/features/candidate-session-v2/candidate-answer-history";
import { createCandidateAnswerCoachingFacts } from "@/features/candidate-session-v2/candidate-coaching-facts";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import { parseAcceptedEvidenceFirstEvaluatorRun } from "@/features/evaluation-v2/evidence-first-evaluator-runtime";

export const candidateCoachUpdateFixtureMetadata = {
    provider: "candidate_v2_coach_update_synthesizer",
    modelName: "deterministic_local_fixture",
    promptVersion: "coach_update_fixture_v1",
    evaluatorVersion: "evidence_first_v1",
    profileId: "candidate_coach_update_fixture_v1",
    configurationFingerprint: createHash("sha256").update(JSON.stringify({
        provider: "candidate_v2_coach_update_synthesizer",
        modelName: "deterministic_local_fixture",
        promptVersion: "coach_update_fixture_v1",
        evaluatorVersion: "evidence_first_v1",
        profileId: "candidate_coach_update_fixture_v1",
    })).digest("hex"),
} as const;

export type CandidateCoachUpdateLifecycleState = "requested" | "completed" | "failed" | "rejected";

export type CandidateCoachUpdateArtifactRecord = {
    candidateCoachUpdateArtifactId: string;
    candidateProfileId: string;
    roleProfileId: string;
    sourceCandidatePracticeSessionId: string;
    sourceCompletionFingerprint: string;
    sourceAnswerAttemptIds: string[];
    acceptedEvaluationRunIds: string[];
    synthesisInputFingerprint: string;
    provider: string;
    modelName: string;
    promptVersion: string;
    evaluatorVersion: string;
    profileId: string | null;
    configurationFingerprint: string | null;
    generationAttempt: number;
    lifecycleState: CandidateCoachUpdateLifecycleState;
    candidateSafeContent: CandidateCoachUpdateContent | null;
    validation: Record<string, unknown> | null;
    errorCode: string | null;
    requestedAt: string;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type CandidateCoachUpdateContent = {
    status: "candidate_coach_update_content_v1";
    targetRole: string;
    title: string;
    summary: string;
    primaryFocus: string;
    questions: CandidateCoachUpdateContentQuestion[];
};

export type CandidateCoachUpdateContentQuestion = {
    questionKey: string;
    questionNumber: number;
    category: string;
    questionText: string;
    answer: {
        candidateAnswerAttemptId: string;
        mode: "text" | "voice" | "photo";
        text: string;
        submittedAt: string;
    };
    coaching: {
        acknowledgement: string;
        observation: string;
        nextPracticeFocus: string;
        overallBand: "not_enough_evidence" | "emerging" | "clear" | "strong";
    };
    comparison: {
        kind: "first_practice" | "repeat_practice";
        priorComparableAttemptCount: number;
        message: string;
    };
    source: {
        candidatePracticeSessionId: string;
        questionKey: string;
    };
};

export type CandidateCoachUpdateSessionEvidence = {
    session: CandidatePracticeSessionRecord;
    answerAttempts: CandidateAnswerAttemptRecord[];
    evaluationRuns: CandidateAnswerEvaluationRunRecord[];
};

export type CandidateCoachUpdateSynthesisInput = {
    status: "candidate_coach_update_synthesis_input_v1";
    candidateProfileId: string;
    roleProfileId: string;
    sourceCandidatePracticeSessionId: string;
    targetRole: string;
    completedAt: string;
    questionCount: number;
    answeredCount: number;
    sourceCompletionFingerprint: string;
    synthesisInputFingerprint: string;
    questions: CandidateCoachUpdateSynthesisQuestion[];
};

export type CandidateCoachUpdateSynthesisQuestion = {
    questionKey: string;
    questionNumber: number;
    category: string;
    questionText: string;
    answerAttempt: CandidateAnswerAttemptRecord;
    acceptedEvaluationRun: CandidateAnswerEvaluationRunRecord;
    acceptedAnalysis: CandidateAnswerAnalysisProviderResult;
    source: {
        candidatePracticeSessionId: string;
        questionKey: string;
    };
    priorComparableAttempts: Array<{
        answerAttempt: CandidateAnswerAttemptRecord;
        acceptedEvaluationRun: CandidateAnswerEvaluationRunRecord;
        acceptedAnalysis: CandidateAnswerAnalysisProviderResult;
    }>;
};

export function createCandidateCoachUpdateSynthesisInput({
    sourceSession,
    sessionEvidence,
}: {
    sourceSession: CandidatePracticeSessionRecord;
    sessionEvidence: CandidateCoachUpdateSessionEvidence[];
}): CandidateCoachUpdateSynthesisInput | null {
    const completion = sourceSession.completionSnapshot;
    const roleProfileId = sourceSession.roleProfileId;
    if (
        sourceSession.status !== "completed"
        || !completion
        || !roleProfileId
        || !sourceSession.questionWordingSnapshot
        || completion.answeredQuestionKeys.length === 0
    ) {
        return null;
    }

    const currentEvidence = sessionEvidence.find(({ session }) => (
        session.candidatePracticeSessionId === sourceSession.candidatePracticeSessionId
        && session.candidateProfileId === sourceSession.candidateProfileId
    ));
    if (!currentEvidence) {
        return null;
    }

    const answeredQuestionKeys = new Set(completion.answeredQuestionKeys);
    const questions: CandidateCoachUpdateSynthesisQuestion[] = [];
    for (const question of sourceSession.questionWordingSnapshot.questions) {
        if (!answeredQuestionKeys.has(question.slotId)) {
            continue;
        }

        const submission = sourceSession.answerSubmissions[question.slotId];
        const answerAttemptId = submission?.answerAttemptId;
        const latestAttempt = [...currentEvidence.answerAttempts]
            .filter((attempt) => attempt.questionSlotId === question.slotId)
            .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
        if (!submission || !answerAttemptId || latestAttempt?.candidateAnswerAttemptId !== answerAttemptId) {
            return null;
        }

        const accepted = findAcceptedCandidateCoachingRun(currentEvidence.evaluationRuns, latestAttempt);
        if (!accepted) {
            return null;
        }

        const source = resolveQuestionSource(sourceSession, question.slotId);
        const priorComparableAttempts = sessionEvidence
            .filter(({ session }) => (
                session.candidateProfileId === sourceSession.candidateProfileId
                && session.roleProfileId === roleProfileId
            ))
            .flatMap((evidence) => evidence.answerAttempts.flatMap((attempt) => {
                if (attempt.candidateAnswerAttemptId === latestAttempt.candidateAnswerAttemptId) {
                    return [];
                }
                const attemptSource = resolveQuestionSource(evidence.session, attempt.questionSlotId);
                if (
                    attemptSource.candidatePracticeSessionId !== source.candidatePracticeSessionId
                    || attemptSource.questionKey !== source.questionKey
                    || attempt.submittedAt.localeCompare(latestAttempt.submittedAt) >= 0
                ) {
                    return [];
                }
                const priorAccepted = findAcceptedCandidateCoachingRun(evidence.evaluationRuns, attempt);
                return priorAccepted ? [{
                    answerAttempt: attempt,
                    acceptedEvaluationRun: priorAccepted.run,
                    acceptedAnalysis: priorAccepted.analysis,
                }] : [];
            }))
            .sort((left, right) => left.answerAttempt.submittedAt.localeCompare(right.answerAttempt.submittedAt));

        questions.push({
            questionKey: question.slotId,
            questionNumber: question.index + 1,
            category: labelForCategory(question.category),
            questionText: question.questionText,
            answerAttempt: latestAttempt,
            acceptedEvaluationRun: accepted.run,
            acceptedAnalysis: accepted.analysis,
            source,
            priorComparableAttempts,
        });
    }

    if (questions.length !== completion.answeredQuestionKeys.length) {
        return null;
    }

    const sourceCompletionFingerprint = hashJson({
        candidateProfileId: sourceSession.candidateProfileId,
        roleProfileId,
        sourceCandidatePracticeSessionId: sourceSession.candidatePracticeSessionId,
        completion,
        questions: questions.map((question) => ({
            questionKey: question.questionKey,
            questionText: question.questionText,
            candidateAnswerAttemptId: question.answerAttempt.candidateAnswerAttemptId,
            answerPayloadFingerprint: question.answerAttempt.payloadFingerprint,
            candidateAnswerEvaluationRunId: question.acceptedEvaluationRun.candidateAnswerEvaluationRunId,
            evaluationInputFingerprint: question.acceptedEvaluationRun.inputFingerprint,
        })),
    });
    const synthesisInputFingerprint = hashJson({
        contract: "candidate_coach_update_synthesis_input_v1",
        sourceCompletionFingerprint,
        comparisons: questions.map((question) => ({
            questionKey: question.questionKey,
            source: question.source,
            prior: question.priorComparableAttempts.map((prior) => ({
                candidateAnswerAttemptId: prior.answerAttempt.candidateAnswerAttemptId,
                payloadFingerprint: prior.answerAttempt.payloadFingerprint,
                candidateAnswerEvaluationRunId: prior.acceptedEvaluationRun.candidateAnswerEvaluationRunId,
                inputFingerprint: prior.acceptedEvaluationRun.inputFingerprint,
            })),
        })),
    });

    return {
        status: "candidate_coach_update_synthesis_input_v1",
        candidateProfileId: sourceSession.candidateProfileId,
        roleProfileId,
        sourceCandidatePracticeSessionId: sourceSession.candidatePracticeSessionId,
        targetRole: sourceSession.setupSnapshot.targetRole,
        completedAt: completion.completedAt,
        questionCount: completion.questionCount,
        answeredCount: completion.answeredCount,
        sourceCompletionFingerprint,
        synthesisInputFingerprint,
        questions,
    };
}

export function createFixtureCandidateCoachUpdateContent(
    input: CandidateCoachUpdateSynthesisInput,
): CandidateCoachUpdateContent {
    const questions = input.questions.map((question) => {
        const coaching = createCandidateAnswerCoachingFacts(question.acceptedAnalysis);
        const priorCount = question.priorComparableAttempts.length;
        return {
            questionKey: question.questionKey,
            questionNumber: question.questionNumber,
            category: question.category,
            questionText: question.questionText,
            answer: {
                candidateAnswerAttemptId: question.answerAttempt.candidateAnswerAttemptId,
                mode: question.answerAttempt.mode,
                text: question.answerAttempt.answerText,
                submittedAt: question.answerAttempt.submittedAt,
            },
            coaching: {
                acknowledgement: coaching.coachFeedback.acknowledgement,
                observation: coaching.coachFeedback.observation,
                nextPracticeFocus: coaching.coachFeedback.nextPracticeFocus,
                overallBand: coaching.overallRead.band,
            },
            comparison: {
                kind: priorCount > 0 ? "repeat_practice" as const : "first_practice" as const,
                priorComparableAttemptCount: priorCount,
                message: priorCount > 0
                    ? "You returned to this question. I compared this response with your earlier practice and kept this update grounded in what you said this time."
                    : "This is the first accepted practice evidence for this question in this prep context.",
            },
            source: question.source,
        };
    });
    const questionNoun = input.answeredCount === 1 ? "question" : "questions";

    return {
        status: "candidate_coach_update_content_v1",
        targetRole: input.targetRole,
        title: `${input.targetRole} practice update`,
        summary: `I reviewed your ${input.answeredCount} practiced ${questionNoun} and connected each update to accepted coaching evidence.`,
        primaryFocus: questions[0]?.coaching.nextPracticeFocus ?? "Keep building practice evidence one answer at a time.",
        questions,
    };
}

export function validateCandidateCoachUpdateContent({
    input,
    content,
}: {
    input: CandidateCoachUpdateSynthesisInput;
    content: CandidateCoachUpdateContent;
}) {
    return isCandidateCoachUpdateContent(content)
        && content.targetRole === input.targetRole
        && content.questions.length === input.questions.length
        && !containsProhibitedGeneratedLanguage(content)
        && content.questions.every((question, index) => {
            const source = input.questions[index];
            return question.questionKey === source.questionKey
                && question.answer.candidateAnswerAttemptId === source.answerAttempt.candidateAnswerAttemptId
                && question.source.candidatePracticeSessionId === source.source.candidatePracticeSessionId
                && question.source.questionKey === source.source.questionKey;
        });
}

function containsProhibitedGeneratedLanguage(content: CandidateCoachUpdateContent) {
    const generatedText = [
        content.title,
        content.summary,
        content.primaryFocus,
        ...content.questions.flatMap((question) => [
            question.coaching.acknowledgement,
            question.coaching.observation,
            question.coaching.nextPracticeFocus,
            question.comparison.message,
        ]),
    ];
    return generatedText.some((value) => (
        /\b(score|scored|scoring|grade|graded|grading|percentile|rank|ranked|ranking|pass|passed|passing|fail|failed|failing)\b/i.test(value)
        || /\b\d{1,3}\s*%\b/.test(value)
    ));
}

export function normalizeCandidateCoachUpdateArtifactRecord(value: unknown): CandidateCoachUpdateArtifactRecord | null {
    if (!isRecord(value)) return null;
    const record = {
        candidateCoachUpdateArtifactId: readString(value.candidate_coach_update_artifact_id ?? value.candidateCoachUpdateArtifactId),
        candidateProfileId: readString(value.candidate_profile_id ?? value.candidateProfileId),
        roleProfileId: readString(value.role_profile_id ?? value.roleProfileId),
        sourceCandidatePracticeSessionId: readString(value.source_candidate_practice_session_id ?? value.sourceCandidatePracticeSessionId),
        sourceCompletionFingerprint: readString(value.source_completion_fingerprint ?? value.sourceCompletionFingerprint),
        sourceAnswerAttemptIds: readStringArray(value.source_answer_attempt_ids_json ?? value.sourceAnswerAttemptIds),
        acceptedEvaluationRunIds: readStringArray(value.accepted_evaluation_run_ids_json ?? value.acceptedEvaluationRunIds),
        synthesisInputFingerprint: readString(value.synthesis_input_fingerprint ?? value.synthesisInputFingerprint),
        provider: readString(value.provider),
        modelName: readString(value.model_name ?? value.modelName),
        promptVersion: readString(value.prompt_version ?? value.promptVersion),
        evaluatorVersion: readString(value.evaluator_version ?? value.evaluatorVersion),
        profileId: readNullableString(value.profile_id ?? value.profileId),
        configurationFingerprint: readNullableString(
            value.configuration_fingerprint ?? value.configurationFingerprint,
        ),
        generationAttempt: readPositiveInteger(value.generation_attempt ?? value.generationAttempt),
        lifecycleState: readLifecycle(value.lifecycle_state ?? value.lifecycleState),
        candidateSafeContent: readCandidateSafeContent(value.candidate_safe_content_json ?? value.candidateSafeContent),
        validation: readNullableRecord(value.validation_json ?? value.validation),
        errorCode: readNullableString(value.error_code ?? value.errorCode),
        requestedAt: readTimestamp(value.requested_at ?? value.requestedAt),
        completedAt: readNullableTimestamp(value.completed_at ?? value.completedAt),
        createdAt: readTimestamp(value.created_at ?? value.createdAt),
        updatedAt: readTimestamp(value.updated_at ?? value.updatedAt),
    };
    if (Object.values(record).some((item) => typeof item === "undefined")) return null;
    if (
        !record.candidateCoachUpdateArtifactId
        || !record.candidateProfileId
        || !record.roleProfileId
        || !record.sourceCandidatePracticeSessionId
        || !record.sourceCompletionFingerprint
        || !record.synthesisInputFingerprint
        || !record.provider
        || !record.modelName
        || !record.promptVersion
        || !record.evaluatorVersion
        || !record.generationAttempt
        || !record.lifecycleState
        || !record.requestedAt
        || !record.createdAt
        || !record.updatedAt
    ) return null;
    if (
        record.lifecycleState === "completed"
        && (
            !record.candidateSafeContent
            || !record.validation
            || record.validation.disposition !== "accepted"
            || !record.completedAt
        )
    ) return null;
    if (record.lifecycleState === "requested" && (record.candidateSafeContent || record.completedAt || record.errorCode)) return null;
    if ((record.lifecycleState === "failed" || record.lifecycleState === "rejected") && (!record.completedAt || !record.errorCode)) return null;
    return record as CandidateCoachUpdateArtifactRecord;
}

function findAcceptedCandidateCoachingRun(
    runs: CandidateAnswerEvaluationRunRecord[],
    attempt: CandidateAnswerAttemptRecord,
) {
    const accepted = runs
        .filter((run) => (
            run.candidateAnswerAttemptId === attempt.candidateAnswerAttemptId
            && run.purpose === "candidate_coaching"
            && run.lifecycleState === "completed"
            && run.validation?.disposition === "accepted"
            && run.validation?.inputFingerprint === run.inputFingerprint
        ))
        .flatMap((run) => {
            const analysis = readAcceptedAnalysis(
                run.result,
                attempt,
                run.inputFingerprint,
                run.candidateAnswerEvaluationRunId,
            );
            return analysis ? [{ run, analysis }] : [];
        })
        .sort((left, right) => (right.run.completedAt ?? "").localeCompare(left.run.completedAt ?? ""));
    return accepted[0] ?? null;
}

function readAcceptedAnalysis(
    value: Record<string, unknown> | null,
    attempt: CandidateAnswerAttemptRecord,
    inputFingerprint: string,
    evaluationRunId: string,
): CandidateAnswerAnalysisProviderResult | null {
    const acceptedRun = parseAcceptedEvidenceFirstEvaluatorRun(value);
    if (
        acceptedRun
        && acceptedRun.inputFingerprint === inputFingerprint
        && acceptedRun.evaluationRunId === evaluationRunId
    ) {
        return createCandidateAnswerAnalysisProjectionFromEvaluatorRun({
            run: acceptedRun,
            answer: {
                slotId: attempt.questionSlotId,
                questionIndex: attempt.questionIndex,
                answerAttemptId: attempt.candidateAnswerAttemptId,
                attemptNumber: attempt.attemptNumber,
                trigger: attempt.trigger,
            },
        });
    }

    if (!isRecord(value) || value.status !== "answer_analysis_provider_result") return null;
    const answer = value.answer;
    const coachFeedback = value.coachFeedback;
    const evidenceFirst = value.evidenceFirst;
    if (
        !isRecord(answer)
        || answer.answerAttemptId !== attempt.candidateAnswerAttemptId
        || answer.slotId !== attempt.questionSlotId
        || !isRecord(coachFeedback)
        || !readString(coachFeedback.acknowledgement)
        || !readString(coachFeedback.observation)
        || !readString(coachFeedback.nextPracticeFocus)
        || !isRecord(evidenceFirst)
        || evidenceFirst.inputFingerprint !== inputFingerprint
    ) return null;
    return value as unknown as CandidateAnswerAnalysisProviderResult;
}

function resolveQuestionSource(session: CandidatePracticeSessionRecord, questionSlotId: string) {
    const followUpPractice = readFollowUpPractice(session.setupSnapshot);
    const item = followUpPractice?.items.find((candidate) => candidate.localSlotId === questionSlotId);
    return item ? {
        candidatePracticeSessionId: item.sourceCandidatePracticeSessionId,
        questionKey: item.sourceQuestionKey,
    } : {
        candidatePracticeSessionId: session.candidatePracticeSessionId,
        questionKey: questionSlotId,
    };
}

function readFollowUpPractice(setupSnapshot: unknown): {
    items: Array<{ localSlotId: string; sourceCandidatePracticeSessionId: string; sourceQuestionKey: string }>;
} | null {
    if (!isRecord(setupSnapshot) || !isRecord(setupSnapshot.followUpPractice)) return null;
    const followUp = setupSnapshot.followUpPractice;
    if (followUp.status !== "candidate_follow_up_practice_session" || !Array.isArray(followUp.items)) return null;
    return {
        items: followUp.items.flatMap((item) => (
            isRecord(item)
            && readString(item.localSlotId)
            && readString(item.sourceCandidatePracticeSessionId)
            && readString(item.sourceQuestionKey)
                ? [{
                    localSlotId: readString(item.localSlotId)!,
                    sourceCandidatePracticeSessionId: readString(item.sourceCandidatePracticeSessionId)!,
                    sourceQuestionKey: readString(item.sourceQuestionKey)!,
                }]
                : []
        )),
    };
}

function hashJson(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function labelForCategory(category: string) {
    return category === "culture_fit" ? "Culture / Fit"
        : category === "case_scenario" ? "Scenario"
            : category === "technical_role_specific" ? "Technical / Role-Specific"
                : `${category.slice(0, 1).toUpperCase()}${category.slice(1)}`;
}

function readCandidateSafeContent(value: unknown): CandidateCoachUpdateContent | null {
    return isCandidateCoachUpdateContent(value) && !containsProhibitedGeneratedLanguage(value) ? value : null;
}

function isCandidateCoachUpdateContent(value: unknown): value is CandidateCoachUpdateContent {
    if (
        !isRecord(value)
        || !hasExactKeys(value, ["status", "targetRole", "title", "summary", "primaryFocus", "questions"])
        || value.status !== "candidate_coach_update_content_v1"
        || !readString(value.targetRole)
        || !readString(value.title)
        || !readString(value.summary)
        || !readString(value.primaryFocus)
        || !Array.isArray(value.questions)
        || value.questions.length === 0
    ) return false;

    return value.questions.every((question) => {
        if (
            !isRecord(question)
            || !hasExactKeys(question, ["questionKey", "questionNumber", "category", "questionText", "answer", "coaching", "comparison", "source"])
            || !readString(question.questionKey)
            || !readPositiveInteger(question.questionNumber)
            || !readString(question.category)
            || !readString(question.questionText)
            || !isRecord(question.answer)
            || !hasExactKeys(question.answer, ["candidateAnswerAttemptId", "mode", "text", "submittedAt"])
            || !readString(question.answer.candidateAnswerAttemptId)
            || !["text", "voice", "photo"].includes(String(question.answer.mode))
            || !readString(question.answer.text)
            || !readTimestamp(question.answer.submittedAt)
            || !isRecord(question.coaching)
            || !hasExactKeys(question.coaching, ["acknowledgement", "observation", "nextPracticeFocus", "overallBand"])
            || !readString(question.coaching.acknowledgement)
            || !readString(question.coaching.observation)
            || !readString(question.coaching.nextPracticeFocus)
            || !["not_enough_evidence", "emerging", "clear", "strong"].includes(String(question.coaching.overallBand))
            || !isRecord(question.comparison)
            || !hasExactKeys(question.comparison, ["kind", "priorComparableAttemptCount", "message"])
            || !["first_practice", "repeat_practice"].includes(String(question.comparison.kind))
            || readNonNegativeInteger(question.comparison.priorComparableAttemptCount) === null
            || !readString(question.comparison.message)
            || !isRecord(question.source)
            || !hasExactKeys(question.source, ["candidatePracticeSessionId", "questionKey"])
            || !readString(question.source.candidatePracticeSessionId)
            || !readString(question.source.questionKey)
        ) return false;

        return !containsDisallowedCandidateContentKey(question);
    });
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function containsDisallowedCandidateContentKey(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(containsDisallowedCandidateContentKey);
    if (!isRecord(value)) return false;
    return Object.entries(value).some(([key, child]) => (
        /score|average|percentile|readiness|rank|pass|fail|onebigupgrade/i.test(key)
        || containsDisallowedCandidateContentKey(child)
    ));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNullableString(value: unknown) {
    return value === null || typeof value === "undefined" ? null : readString(value);
}

function readStringArray(value: unknown) {
    return Array.isArray(value) && value.every((item) => Boolean(readString(item))) ? value as string[] : undefined;
}

function readPositiveInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function readNonNegativeInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readLifecycle(value: unknown): CandidateCoachUpdateLifecycleState | null {
    return value === "requested" || value === "completed" || value === "failed" || value === "rejected" ? value : null;
}

function readTimestamp(value: unknown) {
    return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : readString(value);
}

function readNullableTimestamp(value: unknown) {
    return value === null || typeof value === "undefined" ? null : readTimestamp(value);
}

function readNullableRecord(value: unknown) {
    return value === null || typeof value === "undefined" ? null : isRecord(value) ? value : null;
}

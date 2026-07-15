import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import type { EvaluationEvidenceItem } from "./evaluation-domain";

export type CandidateQaEvalPrivacyShape = {
    candidateProfileId: "redacted";
    hasResumeText: boolean;
    jobDescriptionFingerprint: string;
    resumeTextFingerprint?: string;
};

export type CandidateQaEvalCaseSnapshot = {
    status: "candidate_qa_eval_case";
    schemaVersion: 1;
    caseId: string;
    inputFingerprint: string;
    candidatePracticeSessionId: string;
    candidateProfileId: "redacted";
    roleProfileId: string | null;
    interviewStage: CandidatePracticeSessionRecord["setupSnapshot"]["interviewStage"];
    questionCount: number;
    setupContext: {
        targetRole: string;
        jobDescriptionFingerprint: string;
        jobDescriptionExcerpt: string;
        resumeIncluded: boolean;
        resumeTextFingerprint?: string;
        resumeTextExcerpt?: string;
    };
    question: {
        slotId: string;
        questionIndex: number;
        category: CandidatePracticeSessionRecord["questionPlanSnapshot"]["slots"][number]["category"];
        questionText: string;
        plannedPurpose: string;
    };
    answer: {
        answerAttemptId?: string;
        attemptNumber?: number;
        trigger?: "initial_submit" | "feedback_retry";
        mode: "text";
        text: string;
        submittedAt: string;
    };
    expectedSignals: CandidateQaExpectedSignal[];
    privacy: CandidateQaEvalPrivacyShape;
};

export type CandidateQaExpectedSignal = {
    criterionId: string;
    expectedApplicability: EvaluationEvidenceItem["applicability"];
    reason: string;
};

export type CandidateQaEvalRunSnapshot = {
    status: "candidate_qa_eval_run";
    schemaVersion: 1;
    runId: string;
    caseId: string;
    inputFingerprint: string;
    provider: CandidateAnswerAnalysisProviderResult["provider"];
    model: {
        provider: string;
        name: string;
        promptVersion: string;
        evaluatorVersion: string;
        params?: Record<string, unknown>;
    };
    requestedAt: string;
    completedAt: string;
    latencyMs?: number;
    tokenUsage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
    parsedOutput: {
        coachFeedback: CandidateAnswerAnalysisProviderResult["coachFeedback"];
        evidence: EvaluationEvidenceItem[];
    };
    validation: {
        mapsToCaseInput: boolean;
        evidenceHasObservedScoresOnly: boolean;
        candidateSafeProjectionHasNoRawScores: boolean;
    };
};

export type CandidateQaEvalComparisonSnapshot = {
    status: "candidate_qa_eval_comparison";
    schemaVersion: 1;
    comparisonId: string;
    caseId: string;
    inputFingerprint: string;
    variantA: CandidateQaEvalRunSummary;
    variantB: CandidateQaEvalRunSummary;
    judgment: {
        preference: "variant_a" | "variant_b" | "tie" | "both_fail" | "not_reviewed";
        reason?: string;
        flags: CandidateQaEvalComparisonFlag[];
    };
};

export type CandidateQaEvalComparisonFlag =
    | "different_case_input"
    | "candidate_safety_regression"
    | "schema_validation_regression"
    | "latency_regression"
    | "cost_regression"
    | "needs_human_review";

export type CandidateQaEvalRunSummary = Pick<
    CandidateQaEvalRunSnapshot,
    "runId" | "caseId" | "inputFingerprint" | "provider" | "model" | "latencyMs" | "tokenUsage" | "validation"
>;

export function createCandidateQaEvalCasesFromPracticeSession(
    session: CandidatePracticeSessionRecord,
): CandidateQaEvalCaseSnapshot[] {
    if (!session.questionWordingSnapshot) {
        return [];
    }

    return session.questionWordingSnapshot.questions.flatMap((question) => {
        const submittedAnswer = session.answerSubmissions[question.slotId];
        if (!submittedAnswer) {
            return [];
        }

        const plannedSlot = session.questionPlanSnapshot.slots.find((slot) => slot.id === question.slotId);
        if (!plannedSlot || submittedAnswer.questionIndex !== question.index) {
            return [];
        }

        const setupContext = {
            targetRole: session.setupSnapshot.targetRole,
            jobDescriptionFingerprint: createStableFingerprint(session.setupSnapshot.jobDescription),
            jobDescriptionExcerpt: createExcerpt(session.setupSnapshot.jobDescription),
            resumeIncluded: Boolean(session.setupSnapshot.resumeText),
            ...(session.setupSnapshot.resumeText
                ? {
                    resumeTextFingerprint: createStableFingerprint(session.setupSnapshot.resumeText),
                    resumeTextExcerpt: createExcerpt(session.setupSnapshot.resumeText),
                }
                : {}),
        };
        const caseInput = {
            setupContext,
            question: {
                slotId: question.slotId,
                questionIndex: question.index,
                category: question.category,
                questionText: question.questionText,
                plannedPurpose: plannedSlot.purpose,
            },
            answer: {
                ...(submittedAnswer.answerAttemptId ? {
                    answerAttemptId: submittedAnswer.answerAttemptId,
                    attemptNumber: submittedAnswer.attemptNumber,
                    trigger: submittedAnswer.trigger,
                } : {}),
                mode: submittedAnswer.mode,
                text: submittedAnswer.text,
                submittedAt: submittedAnswer.submittedAt,
            },
            expectedSignals: createExpectedSignals(question.category),
        };
        const inputFingerprint = createStableFingerprint(caseInput);

        return [{
            status: "candidate_qa_eval_case" as const,
            schemaVersion: 1 as const,
            caseId: [
                "candidate-qa-case",
                session.candidatePracticeSessionId,
                question.slotId,
                ...(submittedAnswer.answerAttemptId ? [submittedAnswer.answerAttemptId] : []),
            ].join(":"),
            inputFingerprint,
            candidatePracticeSessionId: session.candidatePracticeSessionId,
            candidateProfileId: "redacted" as const,
            roleProfileId: session.roleProfileId,
            interviewStage: session.setupSnapshot.interviewStage,
            questionCount: session.setupSnapshot.questionCount,
            setupContext,
            question: caseInput.question,
            answer: caseInput.answer,
            expectedSignals: caseInput.expectedSignals,
            privacy: {
                candidateProfileId: "redacted" as const,
                hasResumeText: Boolean(session.setupSnapshot.resumeText),
                jobDescriptionFingerprint: setupContext.jobDescriptionFingerprint,
                ...(setupContext.resumeTextFingerprint
                    ? { resumeTextFingerprint: setupContext.resumeTextFingerprint }
                    : {}),
            },
        }];
    });
}

export function createCandidateQaEvalRunSnapshot({
    qaCase,
    analysis,
    model,
    requestedAt,
    latencyMs,
    tokenUsage,
}: {
    qaCase: CandidateQaEvalCaseSnapshot;
    analysis: CandidateAnswerAnalysisProviderResult;
    model: CandidateQaEvalRunSnapshot["model"];
    requestedAt: string;
    latencyMs?: number;
    tokenUsage?: CandidateQaEvalRunSnapshot["tokenUsage"];
}): CandidateQaEvalRunSnapshot {
    const mapsToCaseInput = analysis.answer.slotId === qaCase.question.slotId
        && analysis.answer.questionIndex === qaCase.question.questionIndex;
    const evidenceHasObservedScoresOnly = analysis.evidence.every((item) => (
        item.applicability === "observed"
            ? typeof item.score === "number" && Number.isFinite(item.score)
            : typeof item.score === "undefined"
    ));

    return {
        status: "candidate_qa_eval_run",
        schemaVersion: 1,
        runId: `candidate-qa-run:${qaCase.caseId}:${model.provider}:${model.name}:${model.promptVersion}:${model.evaluatorVersion}:${analysis.analyzedAt}`,
        caseId: qaCase.caseId,
        inputFingerprint: qaCase.inputFingerprint,
        provider: analysis.provider,
        model,
        requestedAt,
        completedAt: analysis.analyzedAt,
        ...(latencyMs === undefined ? {} : { latencyMs }),
        ...(tokenUsage ? { tokenUsage } : {}),
        parsedOutput: {
            coachFeedback: analysis.coachFeedback,
            evidence: analysis.evidence,
        },
        validation: {
            mapsToCaseInput,
            evidenceHasObservedScoresOnly,
            candidateSafeProjectionHasNoRawScores: !containsRawScoreLanguage(analysis.coachFeedback),
        },
    };
}

export function createCandidateQaEvalComparisonSnapshot({
    comparisonId,
    variantA,
    variantB,
    preference = "not_reviewed",
    reason,
}: {
    comparisonId: string;
    variantA: CandidateQaEvalRunSnapshot;
    variantB: CandidateQaEvalRunSnapshot;
    preference?: CandidateQaEvalComparisonSnapshot["judgment"]["preference"];
    reason?: string;
}): CandidateQaEvalComparisonSnapshot {
    const sameInput = variantA.caseId === variantB.caseId
        && variantA.inputFingerprint === variantB.inputFingerprint;
    const flags: CandidateQaEvalComparisonFlag[] = [];

    if (!sameInput) {
        flags.push("different_case_input");
    }
    if (!variantA.validation.candidateSafeProjectionHasNoRawScores || !variantB.validation.candidateSafeProjectionHasNoRawScores) {
        flags.push("candidate_safety_regression");
    }
    if (!variantA.validation.mapsToCaseInput || !variantB.validation.mapsToCaseInput || !variantA.validation.evidenceHasObservedScoresOnly || !variantB.validation.evidenceHasObservedScoresOnly) {
        flags.push("schema_validation_regression");
    }
    if (preference === "not_reviewed") {
        flags.push("needs_human_review");
    }

    return {
        status: "candidate_qa_eval_comparison",
        schemaVersion: 1,
        comparisonId,
        caseId: sameInput ? variantA.caseId : "mismatched_case_input",
        inputFingerprint: sameInput ? variantA.inputFingerprint : "mismatched_case_input",
        variantA: summarizeRun(variantA),
        variantB: summarizeRun(variantB),
        judgment: {
            preference,
            ...(reason ? { reason } : {}),
            flags,
        },
    };
}

function createExpectedSignals(
    category: CandidateQaEvalCaseSnapshot["question"]["category"],
): CandidateQaExpectedSignal[] {
    const broadlyObservable: CandidateQaExpectedSignal[] = [
        {
            criterionId: "focus_relevance",
            expectedApplicability: "observed",
            reason: "Every answer should address the question being asked.",
        },
        {
            criterionId: "structural_clarity",
            expectedApplicability: "observed",
            reason: "Every answer can provide evidence of organization and clarity.",
        },
        {
            criterionId: "specificity_concreteness",
            expectedApplicability: "observed",
            reason: "Every answer can include concrete details or role-specific examples.",
        },
    ];

    if (category === "behavioral" || category === "case_scenario") {
        return [
            ...broadlyObservable,
            {
                criterionId: "outcome_explicitness",
                expectedApplicability: "observed",
                reason: "Behavioral and scenario questions should create an opportunity to explain what changed or what would happen next.",
            },
            {
                criterionId: "decision_rationale",
                expectedApplicability: "observed",
                reason: "Behavioral and scenario questions should create an opportunity to explain reasoning.",
            },
        ];
    }

    return [
        ...broadlyObservable,
        {
            criterionId: "outcome_explicitness",
            expectedApplicability: "not_elicited",
            reason: "This question category may not reasonably ask for an outcome unless the answer supplies one.",
        },
        {
            criterionId: "decision_rationale",
            expectedApplicability: "not_elicited",
            reason: "This question category may not reasonably ask for reasoning unless the answer supplies it.",
        },
    ];
}

function summarizeRun(run: CandidateQaEvalRunSnapshot): CandidateQaEvalRunSummary {
    return {
        runId: run.runId,
        caseId: run.caseId,
        inputFingerprint: run.inputFingerprint,
        provider: run.provider,
        model: run.model,
        ...(run.latencyMs === undefined ? {} : { latencyMs: run.latencyMs }),
        ...(run.tokenUsage ? { tokenUsage: run.tokenUsage } : {}),
        validation: run.validation,
    };
}

function containsRawScoreLanguage(feedback: CandidateAnswerAnalysisProviderResult["coachFeedback"]) {
    return Object.values(feedback).some((value) => /\bscore\b|\b\d(?:\.\d+)?\s*\/\s*5\b/i.test(value));
}

function createExcerpt(value: string, maxLength = 320) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length <= maxLength
        ? normalized
        : `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function createStableFingerprint(value: unknown) {
    const text = stableStringify(value);
    let hash = 0x811c9dc5;

    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    return `fp_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(",")}}`;
}

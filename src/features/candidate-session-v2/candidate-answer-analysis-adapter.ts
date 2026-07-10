import type { CandidateSetupPayload } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { EvaluationEvidenceItem } from "@/features/evaluation-v2/evaluation-domain";

import type { CandidateAnswerAnalysisRequest, CandidateAnswerMode } from "./candidate-answer-lifecycle";
import type { CandidateQuestionPlanCategory } from "./candidate-question-plan";

export type CandidateAnswerAnalysisProviderName = "candidate_v2_answer_evaluator";

export type CandidateAnswerAnalysisSetupSnapshot = CandidateSetupPayload & {
    createdAt: string;
};

export type CandidateAnswerAnalysisQuestion = {
    slotId: string;
    index: number;
    category: CandidateQuestionPlanCategory;
    questionText: string;
};

export type CandidateAnswerAnalysisProviderRequest = {
    status: "answer_analysis_provider_requested";
    provider: CandidateAnswerAnalysisProviderName;
    requestedAt: string;
    answer: {
        slotId: string;
        questionIndex: number;
        mode: CandidateAnswerMode;
        text: string;
        submittedAt: string;
    };
    question: {
        slotId: string;
        questionIndex: number;
        category: CandidateQuestionPlanCategory;
        questionText: string;
    };
    setupContext: {
        targetRole: string;
        jobDescription: string;
        resumeText: string | null;
        interviewStage: CandidateSetupPayload["interviewStage"];
        questionCount: number;
    };
};

export type CandidateAnswerAnalysisCoachFeedback = {
    acknowledgement: string;
    observation: string;
    nextPracticeFocus: string;
};

export type CandidateAnswerAnalysisProviderResult = {
    status: "answer_analysis_provider_result";
    provider: CandidateAnswerAnalysisProviderName;
    analyzedAt: string;
    answer: {
        slotId: string;
        questionIndex: number;
    };
    coachFeedback: CandidateAnswerAnalysisCoachFeedback;
    evidence: EvaluationEvidenceItem[];
};

const providerName: CandidateAnswerAnalysisProviderName = "candidate_v2_answer_evaluator";
const evidenceApplicabilities = new Set([
    "observed",
    "not_elicited",
    "insufficient_data",
    "unscoreable",
]);

export function createCandidateAnswerAnalysisProviderRequest({
    request,
    question,
    setupSnapshot,
}: {
    request: CandidateAnswerAnalysisRequest;
    question: CandidateAnswerAnalysisQuestion;
    setupSnapshot: CandidateAnswerAnalysisSetupSnapshot;
}): CandidateAnswerAnalysisProviderRequest {
    const answer = request.answerSubmission;

    if (answer.slotId !== question.slotId || answer.questionIndex !== question.index) {
        throw new Error("Answer analysis provider request must map to the submitted answer slot.");
    }

    return {
        status: "answer_analysis_provider_requested",
        provider: providerName,
        requestedAt: request.requestedAt,
        answer: {
            slotId: answer.slotId,
            questionIndex: answer.questionIndex,
            mode: answer.mode,
            text: answer.text,
            submittedAt: answer.submittedAt,
        },
        question: {
            slotId: question.slotId,
            questionIndex: question.index,
            category: question.category,
            questionText: question.questionText,
        },
        setupContext: {
            targetRole: setupSnapshot.targetRole,
            jobDescription: setupSnapshot.jobDescription,
            resumeText: setupSnapshot.resumeText,
            interviewStage: setupSnapshot.interviewStage,
            questionCount: setupSnapshot.questionCount,
        },
    };
}

export function parseCandidateAnswerAnalysisProviderResult(
    value: unknown,
    request: CandidateAnswerAnalysisRequest,
): CandidateAnswerAnalysisProviderResult | null {
    if (!isObject(value) || value.status !== "answer_analysis_provider_result" || value.provider !== providerName) {
        return null;
    }

    const analyzedAt = readNonEmptyString(value.analyzedAt);
    const answer = parseAnswerReference(value.answer);
    const coachFeedback = parseCoachFeedback(value.coachFeedback);
    const evidence = parseEvidenceItems(value.evidence);

    if (!analyzedAt || !answer || !coachFeedback || !evidence) {
        return null;
    }

    if (
        answer.slotId !== request.answerSubmission.slotId
        || answer.questionIndex !== request.answerSubmission.questionIndex
    ) {
        return null;
    }

    return {
        status: "answer_analysis_provider_result",
        provider: providerName,
        analyzedAt,
        answer,
        coachFeedback,
        evidence,
    };
}

function parseAnswerReference(value: unknown): CandidateAnswerAnalysisProviderResult["answer"] | null {
    if (!isObject(value)) {
        return null;
    }

    const slotId = readNonEmptyString(value.slotId);
    if (
        !slotId
        || typeof value.questionIndex !== "number"
        || !Number.isInteger(value.questionIndex)
        || value.questionIndex < 0
    ) {
        return null;
    }

    return {
        slotId,
        questionIndex: value.questionIndex,
    };
}

function parseCoachFeedback(value: unknown): CandidateAnswerAnalysisCoachFeedback | null {
    if (!isObject(value)) {
        return null;
    }

    const acknowledgement = readNonEmptyString(value.acknowledgement);
    const observation = readNonEmptyString(value.observation);
    const nextPracticeFocus = readNonEmptyString(value.nextPracticeFocus);

    if (!acknowledgement || !observation || !nextPracticeFocus) {
        return null;
    }

    return {
        acknowledgement,
        observation,
        nextPracticeFocus,
    };
}

function parseEvidenceItems(value: unknown): EvaluationEvidenceItem[] | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const evidence = value.map(parseEvidenceItem);
    if (evidence.some((item) => item === null)) {
        return null;
    }

    return evidence as EvaluationEvidenceItem[];
}

function parseEvidenceItem(value: unknown): EvaluationEvidenceItem | null {
    if (!isObject(value)) {
        return null;
    }

    const criterionId = readNonEmptyString(value.criterionId);
    const applicability = readEvidenceApplicability(value.applicability);
    if (!criterionId || !applicability) {
        return null;
    }

    if (applicability !== "observed") {
        return typeof value.score === "undefined"
            ? { criterionId, applicability }
            : null;
    }

    if (typeof value.score !== "number" || !Number.isFinite(value.score)) {
        return null;
    }

    return {
        criterionId,
        applicability,
        score: value.score,
    };
}

function readEvidenceApplicability(value: unknown): EvaluationEvidenceItem["applicability"] | null {
    return typeof value === "string" && evidenceApplicabilities.has(value)
        ? value as EvaluationEvidenceItem["applicability"]
        : null;
}

function readNonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

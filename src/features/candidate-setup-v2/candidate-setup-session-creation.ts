import {
    parseCandidateSetupInput,
    type CandidateSetupPayload,
} from "./candidate-setup-contract";
import {
    createCandidateQuestionPlan,
    type CandidateQuestionPlan,
} from "@/features/candidate-session-v2/candidate-question-plan";
import {
    createFixtureCandidateQuestionWordingResult,
    type CandidateQuestionWordingResult,
} from "@/features/candidate-session-v2/candidate-question-wording";

export type CandidateSetupSessionCreationInput = {
    payload: unknown;
    now: Date;
    createSessionId: () => string;
};

export type CandidateSetupSessionCreationResult = {
    status: "session_created";
    sessionId: string;
    nextRoute: `/candidate/session/${string}`;
    setupSnapshot: CandidateSetupPayload & {
        createdAt: string;
    };
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult;
};

export function createCandidateSetupSessionTransition({
    payload,
    now,
    createSessionId,
}: CandidateSetupSessionCreationInput): CandidateSetupSessionCreationResult {
    const setupPayload = parseCandidateSetupInput(payload);
    const sessionId = normalizeSessionId(createSessionId());
    const setupSnapshot = {
        ...setupPayload,
        createdAt: now.toISOString(),
    };
    const questionPlanSnapshot = createCandidateQuestionPlan({
        interviewStage: setupPayload.interviewStage,
        questionCount: setupPayload.questionCount,
    });

    return {
        status: "session_created",
        sessionId,
        nextRoute: `/candidate/session/${encodeURIComponent(sessionId)}`,
        setupSnapshot,
        questionPlanSnapshot,
        questionWordingSnapshot: createFixtureCandidateQuestionWordingResult({
            setupSnapshot,
            questionPlanSnapshot,
        }),
    };
}

function normalizeSessionId(value: string) {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error("Session id is required.");
    }
    return normalized;
}

import {
    parseCandidateSetupInput,
    type CandidateSetupPayload,
} from "./candidate-setup-contract";
import {
    type CandidateQuestionPlan,
} from "@/features/candidate-session-v2/candidate-question-plan";
import {
    createFixtureCandidateQuestionWordingResult,
    type CandidateQuestionWordingResult,
} from "@/features/candidate-session-v2/candidate-question-wording";
import {
    createCandidatePracticePlanBaseline,
    createCandidateQuestionGenerationPlan,
    deriveCandidateBaselineWording,
    deriveCandidateInitialRoundPlan,
    deriveCandidateInitialRoundWording,
    type CandidatePracticePlanBaselineSnapshot,
} from "./candidate-practice-plan-baseline";

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
    rigorBaselineSnapshot?: CandidatePracticePlanBaselineSnapshot;
    rigorBaselineQuestionWordingSnapshot?: CandidateQuestionWordingResult;
    questionPlanSnapshot: CandidateQuestionPlan;
    questionWordingSnapshot: CandidateQuestionWordingResult;
};

export type CandidateSetupSessionPlanResult = Omit<
    CandidateSetupSessionCreationResult,
    "rigorBaselineQuestionWordingSnapshot" | "questionWordingSnapshot"
> & {
    rigorBaselineSnapshot: CandidatePracticePlanBaselineSnapshot;
    questionGenerationPlanSnapshot: CandidateQuestionPlan;
};

export function createCandidateSetupSessionTransition({
    payload,
    now,
    createSessionId,
}: CandidateSetupSessionCreationInput): CandidateSetupSessionCreationResult {
    const plan = createCandidateSetupSessionPlan({ payload, now, createSessionId });

    return completeCandidateSetupSessionTransition({
        plan,
        questionGenerationWordingSnapshot: createFixtureCandidateQuestionWordingResult({
            setupSnapshot: {
                ...plan.setupSnapshot,
                questionCount: plan.questionGenerationPlanSnapshot.questionCount,
            },
            questionPlanSnapshot: plan.questionGenerationPlanSnapshot,
        }),
    });
}

export function createCandidateSetupSessionPlan({
    payload,
    now,
    createSessionId,
}: CandidateSetupSessionCreationInput): CandidateSetupSessionPlanResult {
    const setupPayload = parseCandidateSetupInput(payload);
    const sessionId = normalizeSessionId(createSessionId());
    const setupSnapshot = {
        ...setupPayload,
        createdAt: now.toISOString(),
    };
    const rigorBaselineSnapshot = createCandidatePracticePlanBaseline(setupPayload.interviewStage);
    const questionGenerationPlanSnapshot = createCandidateQuestionGenerationPlan({
        baseline: rigorBaselineSnapshot,
        selectedQuestionCount: setupPayload.questionCount,
    });
    const questionPlanSnapshot = deriveCandidateInitialRoundPlan({
        baseline: rigorBaselineSnapshot,
        generationPlan: questionGenerationPlanSnapshot,
        selectedQuestionCount: setupPayload.questionCount,
    });

    return {
        status: "session_created",
        sessionId,
        nextRoute: `/candidate/session/${encodeURIComponent(sessionId)}`,
        setupSnapshot,
        rigorBaselineSnapshot,
        questionGenerationPlanSnapshot,
        questionPlanSnapshot,
    };
}

export function completeCandidateSetupSessionTransition({
    plan,
    questionGenerationWordingSnapshot,
}: {
    plan: CandidateSetupSessionPlanResult;
    questionGenerationWordingSnapshot: CandidateQuestionWordingResult;
}): CandidateSetupSessionCreationResult {
    return {
        status: plan.status,
        sessionId: plan.sessionId,
        nextRoute: plan.nextRoute,
        setupSnapshot: plan.setupSnapshot,
        rigorBaselineSnapshot: plan.rigorBaselineSnapshot,
        questionPlanSnapshot: plan.questionPlanSnapshot,
        rigorBaselineQuestionWordingSnapshot: deriveCandidateBaselineWording({
            baseline: plan.rigorBaselineSnapshot,
            generatedWording: questionGenerationWordingSnapshot,
        }),
        questionWordingSnapshot: deriveCandidateInitialRoundWording({
            roundPlan: plan.questionPlanSnapshot,
            generatedWording: questionGenerationWordingSnapshot,
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

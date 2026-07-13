import type {
    CreateCandidatePracticeSessionInput,
    CandidatePracticeSessionRecord,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type {
    CandidateQuestionPlan,
    CandidateQuestionPlanCategory,
    CandidateQuestionPlanSlot,
} from "@/features/candidate-session-v2/candidate-question-plan";
import type {
    CandidateQuestionWordingQuestion,
    CandidateQuestionWordingResult,
} from "@/features/candidate-session-v2/candidate-question-wording";
import type {
    CandidatePracticeIntentItem,
    CandidatePracticeIntentRecord,
} from "./candidate-follow-up-practice-intent";

export type CandidateFollowUpPracticeSessionMetadata = {
    status: "candidate_follow_up_practice_session";
    sourceIntentId: string;
    source: CandidatePracticeIntentRecord["source"];
    sessionAttemptNumber: number;
    itemCount: number;
    items: CandidateFollowUpPracticeSessionItemMetadata[];
};

export type CandidateFollowUpPracticeSessionItemMetadata = {
    localSlotId: string;
    localQuestionNumber: number;
    candidatePracticeSessionId: string;
    questionKey: string;
    sourceCandidatePracticeSessionId: string;
    sourceQuestionKey: string;
    sourceQuestionNumber: number;
    sourceQuestionText: string;
    sourceCategory: string;
    questionAttemptNumber: number;
    practiceKind: CandidatePracticeIntentItem["kind"];
};

export type CandidateFollowUpQuestionPlanSlot = CandidateQuestionPlanSlot & {
    sourceQuestion: CandidateFollowUpPracticeSessionItemMetadata;
};

export type CandidateFollowUpQuestionPlan = CandidateQuestionPlan & {
    followUpPractice: {
        sourceIntentId: string;
        source: CandidatePracticeIntentRecord["source"];
        sessionAttemptNumber: number;
        itemCount: number;
    };
    slots: CandidateFollowUpQuestionPlanSlot[];
};

export type CandidateFollowUpQuestionWordingQuestion = CandidateQuestionWordingQuestion & {
    sourceQuestion: CandidateFollowUpPracticeSessionItemMetadata;
};

export type CandidateFollowUpQuestionWordingResult = CandidateQuestionWordingResult & {
    followUpPractice: {
        sourceIntentId: string;
        source: CandidatePracticeIntentRecord["source"];
        sessionAttemptNumber: number;
        itemCount: number;
    };
    questions: CandidateFollowUpQuestionWordingQuestion[];
};

export function createCandidateFollowUpSessionInputFromIntent({
    candidateProfileId,
    intent,
    existingPracticeSessions,
    now,
}: {
    candidateProfileId: string;
    intent: CandidatePracticeIntentRecord;
    existingPracticeSessions: CandidatePracticeSessionRecord[];
    now: Date;
}): CreateCandidatePracticeSessionInput | null {
    if (intent.lifecycleState !== "ready" || intent.items.length < 1) {
        return null;
    }

    const sourceSession = findSourceSession(intent.items[0], existingPracticeSessions);
    if (!sourceSession || sourceSession.candidateProfileId !== candidateProfileId) {
        return null;
    }

    const sessionAttemptNumber = countPriorSessionsForTarget(intent.targetRole, existingPracticeSessions) + 1;
    const followUpItems = intent.items.map((item, index) => {
        const localSlotId = `slot-${index + 1}`;
        return {
            localSlotId,
            localQuestionNumber: index + 1,
            candidatePracticeSessionId: item.source.candidatePracticeSessionId,
            questionKey: item.source.questionKey,
            sourceCandidatePracticeSessionId: item.source.candidatePracticeSessionId,
            sourceQuestionKey: item.source.questionKey,
            sourceQuestionNumber: item.source.questionNumber,
            sourceQuestionText: item.source.questionText,
            sourceCategory: item.source.category,
            questionAttemptNumber: countPriorQuestionAttempts(item, existingPracticeSessions) + 1,
            practiceKind: item.kind,
        };
    });
    const followUpPractice: CandidateFollowUpPracticeSessionMetadata = {
        status: "candidate_follow_up_practice_session",
        sourceIntentId: intent.candidatePracticeIntentId,
        source: intent.source,
        sessionAttemptNumber,
        itemCount: intent.items.length,
        items: followUpItems,
    };
    const categoryCounts = createEmptyCategoryCounts();
    const slots = intent.items.map((item, index): CandidateFollowUpQuestionPlanSlot => {
        const category = normalizeCategory(item.source.category);
        categoryCounts[category] += 1;

        return {
            id: `slot-${index + 1}`,
            index,
            category,
            label: item.source.category,
            purpose: item.display.body,
            sourceQuestion: followUpItems[index],
        };
    });
    const questionPlanSnapshot: CandidateFollowUpQuestionPlan = {
        interviewStage: intent.setupContext.interviewStage,
        questionCount: intent.items.length,
        categoryCounts,
        slots,
        followUpPractice: {
            sourceIntentId: intent.candidatePracticeIntentId,
            source: intent.source,
            sessionAttemptNumber,
            itemCount: intent.items.length,
        },
    };
    const questionWordingSnapshot: CandidateFollowUpQuestionWordingResult = {
        status: "questions_worded",
        questions: intent.items.map((item, index) => ({
            slotId: `slot-${index + 1}`,
            index,
            category: slots[index].category,
            questionText: item.source.questionText,
            sourceQuestion: followUpItems[index],
        })),
        followUpPractice: questionPlanSnapshot.followUpPractice,
    };

    return {
        candidateProfileId,
        roleProfileId: sourceSession.roleProfileId,
        candidateLaunchSessionId: sourceSession.candidateLaunchSessionId,
        setupSnapshot: {
            targetRole: sourceSession.setupSnapshot.targetRole,
            jobDescription: sourceSession.setupSnapshot.jobDescription,
            resumeText: sourceSession.setupSnapshot.resumeText,
            interviewStage: sourceSession.setupSnapshot.interviewStage,
            questionCount: intent.items.length,
            resumeCaptureMode: sourceSession.setupSnapshot.resumeCaptureMode,
            createdAt: now.toISOString(),
            followUpPractice,
        },
        questionPlanSnapshot,
        questionWordingSnapshot,
        progress: {
            status: "planned",
            currentQuestionIndex: 0,
        },
    } as CreateCandidatePracticeSessionInput;
}

function findSourceSession(
    item: CandidatePracticeIntentItem,
    existingPracticeSessions: CandidatePracticeSessionRecord[],
) {
    return existingPracticeSessions.find((session) => (
        session.candidatePracticeSessionId === item.source.candidatePracticeSessionId
    )) ?? null;
}

function countPriorSessionsForTarget(targetRole: string, existingPracticeSessions: CandidatePracticeSessionRecord[]) {
    const normalizedTargetRole = normalizeTargetRole(targetRole);
    return existingPracticeSessions.filter((session) => (
        normalizeTargetRole(session.setupSnapshot.targetRole) === normalizedTargetRole
    )).length;
}

function countPriorQuestionAttempts(
    item: CandidatePracticeIntentItem,
    existingPracticeSessions: CandidatePracticeSessionRecord[],
) {
    let count = 0;

    for (const session of existingPracticeSessions) {
        if (
            session.candidatePracticeSessionId === item.source.candidatePracticeSessionId
            && session.answerSubmissions[item.source.questionKey]
        ) {
            count += 1;
        }

        const followUpPractice = readFollowUpPractice(session.setupSnapshot);
        if (!followUpPractice) {
            continue;
        }

        const matchingItem = followUpPractice.items.find((followUpItem) => (
            followUpItem.sourceCandidatePracticeSessionId === item.source.candidatePracticeSessionId
            && followUpItem.sourceQuestionKey === item.source.questionKey
        ));

        if (matchingItem) {
            count += 1;
        }
    }

    return count;
}

function readFollowUpPractice(value: unknown): CandidateFollowUpPracticeSessionMetadata | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const setupSnapshot = value as { followUpPractice?: unknown };
    const followUpPractice = setupSnapshot.followUpPractice;
    if (
        !followUpPractice
        || typeof followUpPractice !== "object"
        || Array.isArray(followUpPractice)
        || (followUpPractice as { status?: unknown }).status !== "candidate_follow_up_practice_session"
        || !Array.isArray((followUpPractice as { items?: unknown }).items)
    ) {
        return null;
    }

    return followUpPractice as CandidateFollowUpPracticeSessionMetadata;
}

function normalizeCategory(category: string): CandidateQuestionPlanCategory {
    const normalized = category.trim().toLowerCase().replace(/\s*\/\s*/g, "_").replace(/[^a-z_]+/g, "_");

    if (normalized.includes("behavioral")) {
        return "behavioral";
    }
    if (normalized.includes("culture")) {
        return "culture_fit";
    }
    if (normalized.includes("scenario") || normalized.includes("case")) {
        return "case_scenario";
    }
    if (normalized.includes("technical") || normalized.includes("role_specific")) {
        return "technical_role_specific";
    }
    return "screening";
}

function createEmptyCategoryCounts(): Record<CandidateQuestionPlanCategory, number> {
    return {
        screening: 0,
        behavioral: 0,
        culture_fit: 0,
        case_scenario: 0,
        technical_role_specific: 0,
    };
}

function normalizeTargetRole(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

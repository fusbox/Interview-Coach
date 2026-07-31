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
    sourceNextRoundDraftId?: string;
    sourceNextRoundDraftVersion?: number;
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
    rootSourceCandidatePracticeSessionId?: string;
    rootSourceQuestionKey?: string;
    sourceQuestionNumber: number;
    sourceQuestionText: string;
    sourceCategory: string;
    questionAttemptNumber: number;
    practiceKind: CandidatePracticeIntentItem["kind"];
    assembly?: NonNullable<CandidatePracticeIntentItem["assembly"]>;
};

export type CandidateFollowUpQuestionPlanSlot = CandidateQuestionPlanSlot & {
    sourceQuestion: CandidateFollowUpPracticeSessionItemMetadata;
};

export type CandidateFollowUpQuestionPlan = CandidateQuestionPlan & {
    followUpPractice: {
        sourceIntentId: string;
        source: CandidatePracticeIntentRecord["source"];
        sourceNextRoundDraftId?: string;
        sourceNextRoundDraftVersion?: number;
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
        sourceNextRoundDraftId?: string;
        sourceNextRoundDraftVersion?: number;
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
    if (
        intent.lifecycleState !== "ready"
        || intent.candidateProfileId !== candidateProfileId
        || intent.items.length < 1
    ) {
        return null;
    }

    const sourceSessions = intent.items.map((item) => findSourceSession(item, existingPracticeSessions));
    if (sourceSessions.some((session) => !session || !sessionMatchesIntentContext({
        session,
        candidateProfileId,
        intent,
    }))) {
        return null;
    }
    const sourceSession = sourceSessions[0];
    if (!sourceSession) {
        return null;
    }
    const sourceQuestionContent = intent.items.map((item, index) => {
        const sourceQuestion = sourceSessions[index]?.questionWordingSnapshot?.questions.find((question) => (
            question.slotId === item.source.questionKey
        ));
        if (
            !sourceQuestion
            || sourceQuestion.questionText !== item.source.questionText
            || sourceQuestion.category !== normalizeCategory(item.source.category)
        ) {
            return null;
        }
        return {
            questionText: sourceQuestion.questionText,
        };
    });
    if (sourceQuestionContent.some((question) => !question)) {
        return null;
    }
    const resolvedSourceQuestionContent = sourceQuestionContent as Array<{
        questionText: string;
    }>;

    const sessionAttemptNumber = countCandidatePriorPracticeSessionsForIntent(intent, existingPracticeSessions) + 1;
    const nextRoundDraftSource = intent.sourceNextRoundDraftId && intent.sourceNextRoundDraftVersion
        ? {
            sourceNextRoundDraftId: intent.sourceNextRoundDraftId,
            sourceNextRoundDraftVersion: intent.sourceNextRoundDraftVersion,
        }
        : {};
    const followUpItems = intent.items.map((item, index) => {
        const localSlotId = `slot-${index + 1}`;
        const rootSource = resolveCandidateFollowUpQuestionRoot({
            candidatePracticeSessionId: item.source.candidatePracticeSessionId,
            questionKey: item.source.questionKey,
            existingPracticeSessions,
        });
        if (!rootSource) {
            return null;
        }
        return {
            localSlotId,
            localQuestionNumber: index + 1,
            candidatePracticeSessionId: item.source.candidatePracticeSessionId,
            questionKey: item.source.questionKey,
            sourceCandidatePracticeSessionId: item.source.candidatePracticeSessionId,
            sourceQuestionKey: item.source.questionKey,
            rootSourceCandidatePracticeSessionId: rootSource.candidatePracticeSessionId,
            rootSourceQuestionKey: rootSource.questionKey,
            sourceQuestionNumber: item.source.questionNumber,
            sourceQuestionText: item.source.questionText,
            sourceCategory: item.source.category,
            questionAttemptNumber: countPriorQuestionAttempts(item, existingPracticeSessions) + 1,
            practiceKind: item.kind,
            ...(item.assembly ? { assembly: item.assembly } : {}),
        };
    });
    if (followUpItems.some((item) => !item)) {
        return null;
    }
    const resolvedFollowUpItems = followUpItems as CandidateFollowUpPracticeSessionItemMetadata[];
    const followUpPractice: CandidateFollowUpPracticeSessionMetadata = {
        status: "candidate_follow_up_practice_session",
        sourceIntentId: intent.candidatePracticeIntentId,
        source: intent.source,
        ...nextRoundDraftSource,
        sessionAttemptNumber,
        itemCount: intent.items.length,
        items: resolvedFollowUpItems,
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
            sourceQuestion: resolvedFollowUpItems[index],
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
            ...nextRoundDraftSource,
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
            ...resolvedSourceQuestionContent[index],
            sourceQuestion: resolvedFollowUpItems[index],
        })),
        followUpPractice: questionPlanSnapshot.followUpPractice,
    };

    return {
        candidateProfileId,
        roleProfileId: intent.roleProfileId,
        candidateLaunchSessionId: sourceSession.candidateLaunchSessionId,
        setupSnapshot: {
            targetRole: sourceSession.setupSnapshot.targetRole,
            jobDescription: sourceSession.setupSnapshot.jobDescription,
            resumeText: sourceSession.setupSnapshot.resumeText,
            interviewStage: sourceSession.setupSnapshot.interviewStage,
            questionCount: intent.items.length,
            resumeCaptureMode: sourceSession.setupSnapshot.resumeCaptureMode,
            ...(intent.setupContext.resumeArtifact
                ? { resumeArtifact: intent.setupContext.resumeArtifact }
                : {}),
            createdAt: now.toISOString(),
            followUpPractice,
        },
        questionPlanSnapshot,
        questionWordingSnapshot,
        progress: {
            status: "live_question",
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

export function countCandidatePriorPracticeSessionsForIntent(
    intent: CandidatePracticeIntentRecord,
    existingPracticeSessions: CandidatePracticeSessionRecord[],
) {
    if (intent.roleProfileId) {
        return existingPracticeSessions.filter((session) => session.roleProfileId === intent.roleProfileId).length;
    }

    const normalizedTargetRole = normalizeTargetRole(intent.targetRole);
    return existingPracticeSessions.filter((session) => (
        !session.roleProfileId
        && normalizeTargetRole(session.setupSnapshot.targetRole) === normalizedTargetRole
    )).length;
}

function sessionMatchesIntentContext({
    session,
    candidateProfileId,
    intent,
}: {
    session: CandidatePracticeSessionRecord;
    candidateProfileId: string;
    intent: CandidatePracticeIntentRecord;
}) {
    if (session.candidateProfileId !== candidateProfileId) {
        return false;
    }
    if (intent.roleProfileId) {
        return session.roleProfileId === intent.roleProfileId;
    }

    return !session.roleProfileId
        && normalizeTargetRole(session.setupSnapshot.targetRole) === normalizeTargetRole(intent.targetRole);
}

function countPriorQuestionAttempts(
    item: CandidatePracticeIntentItem,
    existingPracticeSessions: CandidatePracticeSessionRecord[],
) {
    const targetRoot = resolveCandidateFollowUpQuestionRoot({
        candidatePracticeSessionId: item.source.candidatePracticeSessionId,
        questionKey: item.source.questionKey,
        existingPracticeSessions,
    });
    if (!targetRoot) {
        return 0;
    }

    let count = 0;

    for (const session of existingPracticeSessions) {
        if (
            session.candidatePracticeSessionId === targetRoot.candidatePracticeSessionId
            && session.answerSubmissions[targetRoot.questionKey]
        ) {
            count += 1;
        }

        const followUpPractice = readCandidateFollowUpPracticeSessionMetadata(session.setupSnapshot);
        if (!followUpPractice) {
            continue;
        }

        const matchingItem = followUpPractice.items.find((followUpItem) => {
            const followUpRoot = readFollowUpItemRoot(followUpItem, existingPracticeSessions);
            return followUpRoot?.candidatePracticeSessionId === targetRoot.candidatePracticeSessionId
                && followUpRoot.questionKey === targetRoot.questionKey;
        });

        if (matchingItem) {
            count += 1;
        }
    }

    return count;
}

export function resolveCandidateFollowUpQuestionRoot({
    candidatePracticeSessionId,
    questionKey,
    existingPracticeSessions,
}: {
    candidatePracticeSessionId: string;
    questionKey: string;
    existingPracticeSessions: CandidatePracticeSessionRecord[];
}) {
    let current = { candidatePracticeSessionId, questionKey };
    const visited = new Set<string>();
    const declaredRoots = new Set<string>();
    let expectedCandidateProfileId: string | null = null;
    let expectedRoleProfileId: string | null | undefined;

    for (let depth = 0; depth <= existingPracticeSessions.length; depth += 1) {
        const key = `${current.candidatePracticeSessionId}:${current.questionKey}`;
        if (visited.has(key)) {
            return null;
        }
        visited.add(key);

        const session = existingPracticeSessions.find((candidateSession) => (
            candidateSession.candidatePracticeSessionId === current.candidatePracticeSessionId
        ));
        if (!session?.questionWordingSnapshot?.questions.some((question) => question.slotId === current.questionKey)) {
            return null;
        }

        if (expectedCandidateProfileId === null) {
            expectedCandidateProfileId = session.candidateProfileId;
            expectedRoleProfileId = session.roleProfileId;
        } else if (
            session.candidateProfileId !== expectedCandidateProfileId
            || session.roleProfileId !== expectedRoleProfileId
        ) {
            return null;
        }

        const followUpPractice = readCandidateFollowUpPracticeSessionMetadata(session.setupSnapshot);
        const sourceItem = followUpPractice?.items.find((followUpItem) => (
            followUpItem.localSlotId === current.questionKey
        ));
        if (!sourceItem) {
            const resolvedKey = `${current.candidatePracticeSessionId}:${current.questionKey}`;
            return declaredRoots.size === 0 || (declaredRoots.size === 1 && declaredRoots.has(resolvedKey))
                ? current
                : null;
        }

        const declaredRootSessionId = readString(sourceItem.rootSourceCandidatePracticeSessionId);
        const declaredRootQuestionKey = readString(sourceItem.rootSourceQuestionKey);
        if (Boolean(declaredRootSessionId) !== Boolean(declaredRootQuestionKey)) {
            return null;
        }
        if (declaredRootSessionId && declaredRootQuestionKey) {
            declaredRoots.add(`${declaredRootSessionId}:${declaredRootQuestionKey}`);
        }

        const sourceSessionId = readString(sourceItem.sourceCandidatePracticeSessionId);
        const sourceQuestionKey = readString(sourceItem.sourceQuestionKey);
        if (!sourceSessionId || !sourceQuestionKey) {
            return null;
        }
        current = {
            candidatePracticeSessionId: sourceSessionId,
            questionKey: sourceQuestionKey,
        };
    }

    return null;
}

function readFollowUpItemRoot(
    item: CandidateFollowUpPracticeSessionItemMetadata,
    existingPracticeSessions: CandidatePracticeSessionRecord[],
) {
    const resolved = resolveCandidateFollowUpQuestionRoot({
        candidatePracticeSessionId: item.sourceCandidatePracticeSessionId,
        questionKey: item.sourceQuestionKey,
        existingPracticeSessions,
    });
    const rootSessionId = readString(item.rootSourceCandidatePracticeSessionId);
    const rootQuestionKey = readString(item.rootSourceQuestionKey);
    if (
        !resolved
        || Boolean(rootSessionId) !== Boolean(rootQuestionKey)
        || (rootSessionId && (
            rootSessionId !== resolved.candidatePracticeSessionId
            || rootQuestionKey !== resolved.questionKey
        ))
    ) {
        return null;
    }

    return resolved;
}

export function readCandidateFollowUpPracticeSessionMetadata(
    value: unknown,
): CandidateFollowUpPracticeSessionMetadata | null {
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

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

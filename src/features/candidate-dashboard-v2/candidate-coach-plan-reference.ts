import {
    readCandidateFollowUpPracticeSessionMetadata,
    resolveCandidateFollowUpQuestionRoot,
} from "@/features/candidate-practice-v2/candidate-follow-up-session-creation";
import { candidateSetupStageOptions } from "@/features/candidate-setup-v2/candidate-setup-contract";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import {
    candidateQuestionPlanCategoryDetails,
    type CandidateQuestionPlanCategory,
} from "@/features/candidate-session-v2/candidate-question-plan";

export type CandidateCoachPlanReference = {
    status: "candidate_coach_plan_reference_ready";
    source: {
        kind: "initial_session_plan";
        baselineCandidatePracticeSessionId: string;
        roleProfileId: string | null;
    };
    targetRole: string;
    stage: {
        id: CandidatePracticeSessionRecord["setupSnapshot"]["interviewStage"];
        label: string;
        detail: string;
    };
    questionCount: number;
    practicedQuestionCount: number;
    missingEvidenceCount: number;
    categories: CandidateCoachPlanCategoryReference[];
    questions: CandidateCoachPlanQuestionReference[];
};

export type CandidateCoachPlanCategoryReference = {
    category: CandidateQuestionPlanCategory;
    label: string;
    purpose: string;
    plannedCount: number;
    practicedCount: number;
    missingEvidenceCount: number;
    teaching: {
        definition: string;
        answerShape: string[];
        watchFor: string[];
    };
};

export type CandidateCoachPlanQuestionReference = {
    questionKey: string;
    questionNumber: number;
    category: CandidateQuestionPlanCategory;
    categoryLabel: string;
    questionText: string | null;
    evidenceStatus: "practiced" | "missing_evidence";
};

export function createCandidateCoachPlanReference({
    candidateProfileId,
    roleProfileId,
    practiceSessions,
}: {
    candidateProfileId: string;
    roleProfileId: string | null;
    practiceSessions: CandidatePracticeSessionRecord[];
}): CandidateCoachPlanReference | null {
    const ownedContextSessions = practiceSessions.filter((session) => (
        session.candidateProfileId === candidateProfileId
        && session.roleProfileId === roleProfileId
    ));
    const originalBaselineSession = [...ownedContextSessions]
        .filter((session) => !readCandidateFollowUpPracticeSessionMetadata(session.setupSnapshot))
        .sort(compareSessionCreation)[0] ?? null;
    const baselineSession = originalBaselineSession
        ?? (roleProfileId === null ? [...ownedContextSessions].sort(compareSessionCreation)[0] ?? null : null);

    if (!baselineSession || baselineSession.questionPlanSnapshot.slots.length === 0) {
        return null;
    }

    const baselineQuestionKeys = new Set(baselineSession.questionPlanSnapshot.slots.map((slot) => slot.id));
    const practicedQuestionKeys = new Set<string>();

    for (const session of ownedContextSessions) {
        for (const [questionKey, submission] of Object.entries(session.answerSubmissions)) {
            if (submission.slotId !== questionKey) {
                continue;
            }
            const root = resolveCandidateFollowUpQuestionRoot({
                candidatePracticeSessionId: session.candidatePracticeSessionId,
                questionKey,
                existingPracticeSessions: ownedContextSessions,
            });
            if (
                root?.candidatePracticeSessionId === baselineSession.candidatePracticeSessionId
                && baselineQuestionKeys.has(root.questionKey)
            ) {
                practicedQuestionKeys.add(root.questionKey);
            }
        }
    }

    const wordingBySlot = new Map(
        baselineSession.questionWordingSnapshot?.questions.map((question) => [question.slotId, question.questionText]) ?? [],
    );
    const questions = baselineSession.questionPlanSnapshot.slots.map((slot) => {
        const detail = candidateQuestionPlanCategoryDetails[slot.category];
        return {
            questionKey: slot.id,
            questionNumber: slot.index + 1,
            category: slot.category,
            categoryLabel: detail.label,
            questionText: wordingBySlot.get(slot.id) ?? null,
            evidenceStatus: practicedQuestionKeys.has(slot.id) ? "practiced" as const : "missing_evidence" as const,
        };
    });
    const categories = createCategoryReferences(questions);
    const practicedQuestionCount = practicedQuestionKeys.size;
    const stage = candidateSetupStageOptions.find((option) => (
        option.id === baselineSession.setupSnapshot.interviewStage
    )) ?? candidateSetupStageOptions[2];

    return {
        status: "candidate_coach_plan_reference_ready",
        source: {
            kind: "initial_session_plan",
            baselineCandidatePracticeSessionId: baselineSession.candidatePracticeSessionId,
            roleProfileId,
        },
        targetRole: baselineSession.setupSnapshot.targetRole,
        stage: {
            id: stage.id,
            label: stage.label,
            detail: stage.detail,
        },
        questionCount: questions.length,
        practicedQuestionCount,
        missingEvidenceCount: questions.length - practicedQuestionCount,
        categories,
        questions,
    };
}

function createCategoryReferences(
    questions: CandidateCoachPlanQuestionReference[],
): CandidateCoachPlanCategoryReference[] {
    const presentCategories = Array.from(new Set(questions.map((question) => question.category)));
    return presentCategories.map((category) => {
        const detail = candidateQuestionPlanCategoryDetails[category];
        const categoryQuestions = questions.filter((question) => question.category === category);
        const practicedCount = categoryQuestions.filter((question) => question.evidenceStatus === "practiced").length;
        return {
            category,
            label: detail.label,
            purpose: detail.purpose,
            plannedCount: categoryQuestions.length,
            practicedCount,
            missingEvidenceCount: categoryQuestions.length - practicedCount,
            teaching: {
                definition: detail.definition,
                answerShape: detail.answerShape,
                watchFor: detail.watchFor,
            },
        };
    });
}

function compareSessionCreation(left: CandidatePracticeSessionRecord, right: CandidatePracticeSessionRecord) {
    return left.setupSnapshot.createdAt.localeCompare(right.setupSnapshot.createdAt)
        || left.candidatePracticeSessionId.localeCompare(right.candidatePracticeSessionId);
}

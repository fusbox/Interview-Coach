import type { CandidateCoachUpdateArtifactRecord } from "./candidate-coach-update-artifact";
import type { CandidateTranscriptCanvasProjection } from "./candidate-transcript-canvas";
import type { CandidateFollowUpPracticeIntentKind } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import {
    resolveCandidateFollowUpPlanQuestionNumber,
    resolveCandidateFollowUpQuestionRoot,
} from "@/features/candidate-practice-v2/candidate-follow-up-session-creation";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";

export type CandidateCoachUpdateDetail = {
    status: "candidate_coach_update_detail_ready";
    presentationKey: string;
    candidatePracticeSessionId: string;
    targetRole: string;
    completedAt: string;
    answeredCount: number;
    questionCount: number;
    reviewPosture: "fully_reviewable";
    summary: string;
    primaryFocus: string;
    items: CandidateCoachUpdateQuestionDetail[];
};

export type CandidateCoachUpdateQuestionDetail = {
    status: "candidate_coach_update_question_detail";
    questionKey: string;
    sourceOccurrence: {
        candidatePracticeSessionId: string;
        questionKey: string;
    };
    canonicalQuestion: {
        candidatePracticeSessionId: string;
        questionKey: string;
    };
    questionNumber: number;
    category: string;
    questionText: string;
    evidenceStatus: "practiced";
    answer: {
        mode: "text" | "voice" | "photo";
        text: string;
        submittedAt: string;
    };
    transcriptCanvas: CandidateTranscriptCanvasProjection | null;
    coachRead: {
        acknowledgement: string;
        observation: string;
        nextPracticeFocus: string;
    };
    comparison: {
        kind: "first_practice" | "repeat_practice";
        priorComparableAttemptCount: number;
        message: string;
    };
    actionPosture: CandidateCoachUpdateActionPosture;
    focusedPracticeAction: CandidateFocusedPracticeAction;
};

export type CandidateCoachUpdateActionPosture = {
    kind: "review_coaching";
    label: "Review coach feedback";
    reason: "This answer has accepted coaching ready.";
};

export type CandidateFocusedPracticeAction = {
    status: "candidate_focused_practice_action";
    kind: "practice_from_feedback";
    label: "Practice this focus";
    href: string;
    source: {
        kind: "coach_update_detail";
        candidatePracticeSessionId: string;
        questionKey: string;
        questionNumber: number;
        category: string;
        targetRole: string;
    };
};

export function createCandidateCoachUpdateDetail(
    artifact: CandidateCoachUpdateArtifactRecord | null,
    sourceSession: CandidatePracticeSessionRecord | null = null,
    practiceSessions: CandidatePracticeSessionRecord[] = sourceSession ? [sourceSession] : [],
): CandidateCoachUpdateDetail | null {
    if (artifact?.lifecycleState !== "completed" || !artifact.candidateSafeContent || !artifact.completedAt) {
        return null;
    }

    const content = artifact.candidateSafeContent;
    const matchedSourceSession = sourceSession?.candidatePracticeSessionId === artifact.sourceCandidatePracticeSessionId
        ? sourceSession
        : null;
    const items = content.questions.map((question) => toQuestionDetail({
        question,
        candidatePracticeSessionId: artifact.sourceCandidatePracticeSessionId,
        targetRole: content.targetRole,
        sourceSession: matchedSourceSession,
        practiceSessions,
    }));

    return {
        status: "candidate_coach_update_detail_ready",
        presentationKey: artifact.candidateCoachUpdateArtifactId,
        candidatePracticeSessionId: artifact.sourceCandidatePracticeSessionId,
        targetRole: content.targetRole,
        completedAt: artifact.completedAt,
        answeredCount: items.length,
        questionCount: items.length,
        reviewPosture: "fully_reviewable",
        summary: content.summary,
        primaryFocus: content.primaryFocus,
        items,
    };
}

export function createCandidateCoachUpdateDetailFromArtifacts({
    artifacts,
    sourceSession,
    practiceSessions,
}: {
    artifacts: CandidateCoachUpdateArtifactRecord[];
    sourceSession: CandidatePracticeSessionRecord | null;
    practiceSessions: CandidatePracticeSessionRecord[];
}): CandidateCoachUpdateDetail | null {
    const details = artifacts.flatMap((artifact) => {
        const detail = createCandidateCoachUpdateDetail(artifact, sourceSession, practiceSessions);
        return detail ? [detail] : [];
    });
    if (details.length === 0) return null;

    const practiceOrderByQuestionKey = new Map(
        Object.entries(sourceSession?.feedbackActionEvents ?? {})
            .sort(([, left], [, right]) => (
                left.selectedAt.localeCompare(right.selectedAt)
            ))
            .map(([questionKey], index) => [questionKey, index]),
    );

    const latest = [...details].sort((left, right) => (
        right.completedAt.localeCompare(left.completedAt)
        || right.presentationKey.localeCompare(left.presentationKey)
    ))[0];
    const latestItemByCanonicalQuestion = new Map<string, {
        detail: CandidateCoachUpdateDetail;
        item: CandidateCoachUpdateQuestionDetail;
    }>();
    for (const detail of details) {
        for (const item of detail.items) {
            const key = `${item.canonicalQuestion.candidatePracticeSessionId}:${item.canonicalQuestion.questionKey}`;
            const current = latestItemByCanonicalQuestion.get(key);
            if (
                !current
                || detail.completedAt.localeCompare(current.detail.completedAt) > 0
                || (
                    detail.completedAt === current.detail.completedAt
                    && detail.presentationKey.localeCompare(current.detail.presentationKey) > 0
                )
            ) {
                latestItemByCanonicalQuestion.set(key, { detail, item });
            }
        }
    }
    const items = Array.from(latestItemByCanonicalQuestion.values())
        .map(({ item }) => item)
        .sort((left, right) => (
            (practiceOrderByQuestionKey.get(left.sourceOccurrence.questionKey) ?? Number.MAX_SAFE_INTEGER)
                - (practiceOrderByQuestionKey.get(right.sourceOccurrence.questionKey) ?? Number.MAX_SAFE_INTEGER)
            || left.questionNumber - right.questionNumber
            || left.sourceOccurrence.questionKey.localeCompare(right.sourceOccurrence.questionKey)
        ));

    return {
        ...latest,
        answeredCount: items.length,
        questionCount: items.length,
        items,
    };
}

function toQuestionDetail({
    question,
    candidatePracticeSessionId,
    targetRole,
    sourceSession,
    practiceSessions,
}: {
    question: NonNullable<CandidateCoachUpdateArtifactRecord["candidateSafeContent"]>["questions"][number];
    candidatePracticeSessionId: string;
    targetRole: string;
    sourceSession: CandidatePracticeSessionRecord | null;
    practiceSessions: CandidatePracticeSessionRecord[];
}): CandidateCoachUpdateQuestionDetail {
    const actionPosture: CandidateCoachUpdateActionPosture = {
        kind: "review_coaching",
        label: "Review coach feedback",
        reason: "This answer has accepted coaching ready.",
    };
    const questionNumber = sourceSession
        ? resolveCandidateFollowUpPlanQuestionNumber({
            session: sourceSession,
            questionKey: question.questionKey,
        }) ?? question.questionNumber
        : question.questionNumber;
    const sourceOccurrence = {
        candidatePracticeSessionId,
        questionKey: question.questionKey,
    };
    const canonicalQuestion = sourceSession
        ? resolveCandidateFollowUpQuestionRoot({
            ...sourceOccurrence,
            existingPracticeSessions: practiceSessions,
        }) ?? sourceOccurrence
        : sourceOccurrence;

    return {
        status: "candidate_coach_update_question_detail",
        questionKey: question.questionKey,
        sourceOccurrence,
        canonicalQuestion,
        questionNumber,
        category: question.category,
        questionText: question.questionText,
        evidenceStatus: "practiced",
        answer: {
            mode: question.answer.mode,
            text: question.answer.text,
            submittedAt: question.answer.submittedAt,
        },
        transcriptCanvas: "transcriptCanvas" in question ? question.transcriptCanvas : null,
        coachRead: question.coaching,
        comparison: question.comparison,
        actionPosture,
        focusedPracticeAction: getFocusedPracticeAction({
            candidatePracticeSessionId,
            targetRole,
            question,
            questionNumber,
        }),
    };
}

function getFocusedPracticeAction({
    candidatePracticeSessionId,
    targetRole,
    question,
    questionNumber,
}: {
    candidatePracticeSessionId: string;
    targetRole: string;
    question: NonNullable<CandidateCoachUpdateArtifactRecord["candidateSafeContent"]>["questions"][number];
    questionNumber: number;
}): CandidateFocusedPracticeAction {
    return {
        status: "candidate_focused_practice_action",
        kind: "practice_from_feedback",
        label: "Practice this focus",
        href: createCandidateFocusedPracticeHref({
            kind: "practice_from_feedback",
            candidatePracticeSessionId,
            questionKey: question.questionKey,
        }),
        source: {
            kind: "coach_update_detail",
            candidatePracticeSessionId,
            questionKey: question.questionKey,
            questionNumber,
            category: question.category,
            targetRole,
        },
    };
}

export function createCandidateFocusedPracticeHref({
    kind,
    candidatePracticeSessionId,
    questionKey,
}: {
    kind: CandidateFollowUpPracticeIntentKind;
    candidatePracticeSessionId: string;
    questionKey: string;
}) {
    const intent = kind === "practice_from_feedback"
        ? "coach-update-feedback-focus"
        : "coach-update-missing-evidence";
    const searchParams = new URLSearchParams({
        intent,
        fromSession: candidatePracticeSessionId,
        questionKey,
    });
    return `/candidate/practice/ready?${searchParams.toString()}`;
}

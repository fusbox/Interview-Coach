import type { CandidateCoachUpdateArtifactRecord } from "./candidate-coach-update-artifact";
import type { CandidateTranscriptCanvasProjection } from "./candidate-transcript-canvas";
import type { CandidateFollowUpPracticeIntentKind } from "@/features/candidate-practice-v2/candidate-follow-up-practice-intent";
import { resolveCandidateFollowUpPlanQuestionNumber } from "@/features/candidate-practice-v2/candidate-follow-up-session-creation";
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

function toQuestionDetail({
    question,
    candidatePracticeSessionId,
    targetRole,
    sourceSession,
}: {
    question: NonNullable<CandidateCoachUpdateArtifactRecord["candidateSafeContent"]>["questions"][number];
    candidatePracticeSessionId: string;
    targetRole: string;
    sourceSession: CandidatePracticeSessionRecord | null;
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

    return {
        status: "candidate_coach_update_question_detail",
        questionKey: question.questionKey,
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

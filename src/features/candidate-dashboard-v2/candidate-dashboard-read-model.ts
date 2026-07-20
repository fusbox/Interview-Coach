import {
    createCandidateCompletedRoundReadModels,
    type CandidateCompletedRoundReadModels,
    type CandidateDashboardCoachUpdate,
    type CandidatePostRoundReview,
    type CandidatePracticeNext,
} from "@/features/candidate-session-v2/candidate-completed-round-read-model";
import type { CandidatePracticeSessionRecord } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidatePracticePlanBaselineRecord } from "@/features/candidate-setup-v2/candidate-practice-plan-baseline-repository";
import {
    createCandidateCoachPlanReference,
    type CandidateCoachPlanReference,
} from "./candidate-coach-plan-reference";
import type { CandidateCoachUpdateArtifactRecord } from "./candidate-coach-update-artifact";
import {
    createCandidateCoachUpdateDetail,
    createCandidateFocusedPracticeHref,
    type CandidateCoachUpdateDetail,
} from "./candidate-coach-update-detail";
import {
    normalizeCandidateRoleProfileId,
    normalizeCandidateTargetInterviewId,
} from "./candidate-dashboard-route";

export type CandidateDashboardV2ReadModel = {
    status: "candidate_dashboard_v2_read_model";
    candidateProfileId: string;
    candidate: CandidateDashboardIdentity;
    selectedTargetInterview: CandidateDashboardTargetInterview | null;
    targetInterviews: CandidateDashboardTargetInterview[];
    source: {
        kind: "derived_from_candidate_practice_sessions";
        durableSource: "candidate_practice_sessions";
        persistence: "read_time_projection";
        shouldPersistDashboardProjection: false;
    };
    stats: {
        activeRoundCount: number;
        completedRoundCount: number;
        answeredQuestionCount: number;
        coachedAnswerCount: number;
        attempts?: CandidateDashboardAttemptRollup;
    };
    activeRound: CandidateDashboardActiveRound | null;
    completedRounds: CandidateCompletedRoundReadModels[];
    latestCoachUpdate: CandidateDashboardCoachUpdate | null;
    coachUpdateState: CandidateDashboardCoachUpdateState;
    coachUpdateDetail: CandidateCoachUpdateDetail | null;
    coachingLoop: CandidateDashboardCoachingLoop;
    postRoundReviews: CandidatePostRoundReview[];
    practiceNext: CandidatePracticeNext;
    practiceDirection: CandidateDashboardPracticeDirection;
    coachPlan: CandidateCoachPlanReference | null;
};

export type CandidateDashboardIdentity = {
    displayName: string | null;
    email: string | null;
};

export type CandidateDashboardTargetInterview = {
    status: "candidate_dashboard_target_interview";
    id: string;
    roleProfileId: string | null;
    targetRole: string;
    isSelected: boolean;
    activeRoundCount: number;
    completedRoundCount: number;
    answeredQuestionCount: number;
    coachedAnswerCount: number;
    lastActivityAt: string;
    attempts?: CandidateDashboardAttemptRollup;
};

export type CandidateDashboardAttemptRollup = {
    sessionAttemptCount: number;
    followUpSessionAttemptCount: number;
    questionAttemptCount: number;
    followUpQuestionAttemptCount: number;
};

export type CandidateDashboardActiveRound = {
    status: "candidate_dashboard_active_round";
    candidatePracticeSessionId: string;
    targetRole: string;
    sessionStatus: "planned" | "in_progress";
    href: string;
    questionCount: number;
    answeredCount: number;
    currentQuestionNumber: number;
    progressLabel: string;
};

export type CandidateDashboardCoachingLoop = {
    status: "candidate_dashboard_coaching_loop_ready";
    principle: "Use what happened in practice to choose the next useful move.";
    feedback: CandidateDashboardFeedbackIndicator | null;
    feedforward: CandidateDashboardFeedforwardIndicator;
};

export type CandidateDashboardCoachUpdateState =
    | {
        status: "candidate_coach_update_awaiting_practice";
      }
    | {
        status: "candidate_coach_update_pending";
        candidatePracticeSessionId: string;
        requestedAt: string;
      }
    | {
        status: "candidate_coach_update_ready";
        candidatePracticeSessionId: string;
        presentationKey: string;
        completedAt: string;
        answeredCount: number;
        questionCount: number;
      }
    | {
        status: "candidate_coach_update_unavailable";
        candidatePracticeSessionId: string;
        reason: "generation_failed" | "generation_rejected" | "artifact_missing";
      };

export type CandidateDashboardFeedbackIndicator = {
    status: "candidate_dashboard_feedback_ready";
    label: "Coach Update";
    title: string;
    body: string;
    href: string;
    completedAt: string;
    answeredCount: number;
    questionCount: number;
    questionContext?: string;
    observation?: string;
};

export type CandidateDashboardFeedforwardIndicator = {
    status: "candidate_dashboard_feedforward_ready";
    label: "Practice Next";
    title: string;
    body: string;
    href: string;
    source: CandidatePracticeNext["source"];
    questionKeys: string[];
};

export type CandidateDashboardPracticeDirection = {
    status: "candidate_dashboard_practice_direction_ready";
    primaryAction: "resume_planned_round" | "finish_planned_coverage" | "practice_from_feedback" | "start_first_round" | "start_new_round";
    planProgress: CandidateDashboardPlanProgressIndicator;
    coachGuidedFocus: CandidateDashboardCoachGuidedFocusIndicator | null;
};

export type CandidateDashboardPlanProgressIndicator = {
    status: "candidate_dashboard_plan_progress_ready";
    label: "Plan progress";
    source: "active_round" | "unanswered_planned_questions" | "completed_plan" | "first_round";
    title: string;
    body: string;
    href: string | null;
    questionKeys: string[];
    candidatePracticeSessionId?: string;
};

export type CandidateDashboardCoachGuidedFocusIndicator = {
    status: "candidate_dashboard_coach_guided_focus_ready";
    label: "Practice from feedback";
    source: "coach_feedback";
    title: string;
    body: string;
    href: string;
    candidatePracticeSessionId: string;
    questionKeys: string[];
};

export function createCandidateDashboardV2ReadModel({
    candidateProfileId,
    practiceSessions,
    selectedRoleProfileId,
    selectedLegacyTargetRole,
    coachUpdateArtifacts = [],
    candidateIdentity,
    practicePlanBaselines = [],
}: {
    candidateProfileId: string;
    practiceSessions: CandidatePracticeSessionRecord[];
    selectedRoleProfileId?: string | null;
    selectedLegacyTargetRole?: string | null;
    coachUpdateArtifacts?: CandidateCoachUpdateArtifactRecord[];
    candidateIdentity?: Partial<CandidateDashboardIdentity> | null;
    practicePlanBaselines?: CandidatePracticePlanBaselineRecord[];
}): CandidateDashboardV2ReadModel {
    const candidateSessions = practiceSessions.filter((session) => session.candidateProfileId === candidateProfileId);
    const selectedContextKey = selectTargetInterviewContextKey({
        candidateSessions,
        requestedRoleProfileId: selectedRoleProfileId,
        requestedLegacyTargetRole: selectedLegacyTargetRole,
    });
    const scopedCandidateSessions = selectedContextKey
        ? candidateSessions.filter((session) => getTargetInterviewContextKey(session) === selectedContextKey)
        : [];
    const targetInterviews = createTargetInterviews(candidateSessions, selectedContextKey);
    const activeSessions = scopedCandidateSessions.filter((session) => (
        session.status === "planned" || session.status === "in_progress"
    ));
    const activeRoundCount = activeSessions.length;
    const activeSession = [...activeSessions].sort((left, right) => (
        right.setupSnapshot.createdAt.localeCompare(left.setupSnapshot.createdAt)
    ))[0] ?? null;
    const completedRounds = scopedCandidateSessions
        .map(createCandidateCompletedRoundReadModels)
        .filter((model): model is CandidateCompletedRoundReadModels => Boolean(model))
        .sort((left, right) => right.round.completedAt.localeCompare(left.round.completedAt));
    const latestPracticeNext = completedRounds[0]?.practiceNext ?? createFirstPracticeNext();
    const attemptRollup = createAttemptRollup(scopedCandidateSessions);
    const questionEvidence = createQuestionEvidenceRollup(scopedCandidateSessions);
    const latestCompletedRound = completedRounds[0] ?? null;
    const latestCoachUpdateArtifact = latestCompletedRound
        ? selectLatestCoachUpdateArtifact({
            artifacts: coachUpdateArtifacts,
            candidateProfileId,
            roleProfileId: selectedRoleProfileIdFromKey(selectedContextKey),
            sourceCandidatePracticeSessionId: latestCompletedRound.round.candidatePracticeSessionId,
        })
        : null;
    const latestCoachUpdate = createDashboardCoachUpdateFromArtifact(latestCoachUpdateArtifact, latestCompletedRound);
    const coachUpdateDetail = createCandidateCoachUpdateDetail(latestCoachUpdateArtifact);
    const resolvedSelectedRoleProfileId = selectedRoleProfileIdFromKey(selectedContextKey);
    const coachPlan = createCandidateCoachPlanReference({
        candidateProfileId,
        roleProfileId: resolvedSelectedRoleProfileId,
        practiceSessions: scopedCandidateSessions,
        practicePlanBaseline: practicePlanBaselines.find((baseline) => (
            baseline.candidateProfileId === candidateProfileId
            && baseline.roleProfileId === resolvedSelectedRoleProfileId
        )) ?? null,
    });

    return {
        status: "candidate_dashboard_v2_read_model",
        candidateProfileId,
        candidate: {
            displayName: normalizeCandidateIdentityText(candidateIdentity?.displayName),
            email: normalizeCandidateIdentityText(candidateIdentity?.email),
        },
        selectedTargetInterview: targetInterviews.find((targetInterview) => targetInterview.isSelected) ?? null,
        targetInterviews,
        source: {
            kind: "derived_from_candidate_practice_sessions",
            durableSource: "candidate_practice_sessions",
            persistence: "read_time_projection",
            shouldPersistDashboardProjection: false,
        },
        stats: {
            activeRoundCount,
            completedRoundCount: completedRounds.length,
            answeredQuestionCount: questionEvidence.answeredQuestionCount,
            coachedAnswerCount: questionEvidence.coachedAnswerCount,
            attempts: attemptRollup,
        },
        activeRound: createActiveRound(activeSession),
        completedRounds,
        latestCoachUpdate,
        coachUpdateState: createCoachUpdateState({
            latestCompletedRound,
            latestArtifact: latestCoachUpdateArtifact,
            detail: coachUpdateDetail,
        }),
        coachUpdateDetail,
        coachingLoop: createCoachingLoop({
            latestCoachUpdate,
            practiceNext: latestPracticeNext,
        }),
        postRoundReviews: completedRounds.map((round) => round.postRoundReview),
        practiceNext: latestPracticeNext,
        practiceDirection: createPracticeDirection({
            activeSession,
            latestCompletedRound: completedRounds[0] ?? null,
            practiceNext: latestPracticeNext,
        }),
        coachPlan,
    };
}

function selectLatestCoachUpdateArtifact({
    artifacts,
    candidateProfileId,
    roleProfileId,
    sourceCandidatePracticeSessionId,
}: {
    artifacts: CandidateCoachUpdateArtifactRecord[];
    candidateProfileId: string;
    roleProfileId: string | null;
    sourceCandidatePracticeSessionId: string;
}) {
    if (!roleProfileId) {
        return null;
    }

    return artifacts
        .filter((artifact) => (
            artifact.candidateProfileId === candidateProfileId
            && artifact.roleProfileId === roleProfileId
            && artifact.sourceCandidatePracticeSessionId === sourceCandidatePracticeSessionId
        ))
        .sort((left, right) => (
            right.generationAttempt - left.generationAttempt
            || right.updatedAt.localeCompare(left.updatedAt)
        ))[0] ?? null;
}

function createCoachUpdateState({
    latestCompletedRound,
    latestArtifact,
    detail,
}: {
    latestCompletedRound: CandidateCompletedRoundReadModels | null;
    latestArtifact: CandidateCoachUpdateArtifactRecord | null;
    detail: CandidateCoachUpdateDetail | null;
}): CandidateDashboardCoachUpdateState {
    if (!latestCompletedRound) {
        return { status: "candidate_coach_update_awaiting_practice" };
    }

    const candidatePracticeSessionId = latestCompletedRound.round.candidatePracticeSessionId;
    if (!latestArtifact) {
        return {
            status: "candidate_coach_update_unavailable",
            candidatePracticeSessionId,
            reason: "artifact_missing",
        };
    }

    if (latestArtifact.lifecycleState === "requested") {
        return {
            status: "candidate_coach_update_pending",
            candidatePracticeSessionId,
            requestedAt: latestArtifact.requestedAt,
        };
    }

    if (latestArtifact.lifecycleState === "failed" || latestArtifact.lifecycleState === "rejected") {
        return {
            status: "candidate_coach_update_unavailable",
            candidatePracticeSessionId,
            reason: latestArtifact.lifecycleState === "rejected" ? "generation_rejected" : "generation_failed",
        };
    }

    if (!detail || !latestArtifact.completedAt) {
        return {
            status: "candidate_coach_update_unavailable",
            candidatePracticeSessionId,
            reason: "generation_rejected",
        };
    }

    return {
        status: "candidate_coach_update_ready",
        candidatePracticeSessionId,
        presentationKey: detail.presentationKey,
        completedAt: latestArtifact.completedAt,
        answeredCount: detail.answeredCount,
        questionCount: latestCompletedRound.round.questionCount,
    };
}

function normalizeCandidateIdentityText(value: string | null | undefined) {
    const normalized = value?.trim();
    return normalized || null;
}

function createDashboardCoachUpdateFromArtifact(
    artifact: CandidateCoachUpdateArtifactRecord | null,
    latestCompletedRound: CandidateCompletedRoundReadModels | null,
): CandidateDashboardCoachUpdate | null {
    const content = artifact?.candidateSafeContent;
    if (!artifact || !content || !artifact.completedAt || !latestCompletedRound) return null;
    const firstQuestion = content.questions[0];
    return {
        status: "candidate_dashboard_coach_update_ready",
        candidatePracticeSessionId: artifact.sourceCandidatePracticeSessionId,
        title: content.title,
        body: content.summary,
        href: "#coach-update-detail",
        completedAt: artifact.completedAt,
        answeredCount: content.questions.length,
        questionCount: latestCompletedRound.round.questionCount,
        ...(firstQuestion ? {
            coachingPreview: {
                questionKey: firstQuestion.questionKey,
                questionNumber: firstQuestion.questionNumber,
                category: firstQuestion.category,
                observation: firstQuestion.coaching.observation,
                nextPracticeFocus: firstQuestion.coaching.nextPracticeFocus,
            },
        } : {}),
    };
}

function selectedRoleProfileIdFromKey(contextKey: string | null) {
    return contextKey?.startsWith("profile:") ? contextKey.slice("profile:".length) : null;
}

function selectTargetInterviewContextKey({
    candidateSessions,
    requestedRoleProfileId,
    requestedLegacyTargetRole,
}: {
    candidateSessions: CandidatePracticeSessionRecord[];
    requestedRoleProfileId?: string | null;
    requestedLegacyTargetRole?: string | null;
}) {
    const availableContextKeys = new Set(candidateSessions.map(getTargetInterviewContextKey));
    const hasRequestedRoleProfileId = Boolean(requestedRoleProfileId?.trim());
    const normalizedRoleProfileId = normalizeCandidateRoleProfileId(requestedRoleProfileId);
    const requestedProfileKey = normalizedRoleProfileId ? createRoleProfileContextKey(normalizedRoleProfileId) : null;
    if (requestedProfileKey && availableContextKeys.has(requestedProfileKey)) {
        return requestedProfileKey;
    }

    const normalizedLegacyTargetRole = hasRequestedRoleProfileId
        ? ""
        : normalizeCandidateTargetInterviewId(requestedLegacyTargetRole);
    const requestedLegacyKey = normalizedLegacyTargetRole
        ? createLegacyTargetRoleContextKey(normalizedLegacyTargetRole)
        : null;
    if (requestedLegacyKey && availableContextKeys.has(requestedLegacyKey)) {
        return requestedLegacyKey;
    }

    const activeSession = [...candidateSessions]
        .filter((session) => session.status === "planned" || session.status === "in_progress")
        .sort((left, right) => right.setupSnapshot.createdAt.localeCompare(left.setupSnapshot.createdAt))[0];
    if (activeSession) {
        return getTargetInterviewContextKey(activeSession);
    }

    const latestCompletedSession = [...candidateSessions]
        .filter((session) => session.status === "completed" && session.completionSnapshot)
        .sort((left, right) => (
            (right.completionSnapshot?.completedAt ?? "").localeCompare(left.completionSnapshot?.completedAt ?? "")
        ))[0];
    if (latestCompletedSession) {
        return getTargetInterviewContextKey(latestCompletedSession);
    }

    const latestSession = [...candidateSessions]
        .sort((left, right) => right.setupSnapshot.createdAt.localeCompare(left.setupSnapshot.createdAt))[0];
    return latestSession ? getTargetInterviewContextKey(latestSession) : null;
}

function createTargetInterviews(
    candidateSessions: CandidatePracticeSessionRecord[],
    selectedContextKey: string | null,
): CandidateDashboardTargetInterview[] {
    const targetInterviewsById = new Map<string, CandidateDashboardTargetInterview>();

    for (const session of candidateSessions) {
        const contextKey = getTargetInterviewContextKey(session);
        const roleProfileId = normalizeCandidateRoleProfileId(session.roleProfileId);
        const id = roleProfileId ?? getLegacyTargetInterviewId(session);
        const current = targetInterviewsById.get(contextKey) ?? {
            status: "candidate_dashboard_target_interview" as const,
            id,
            roleProfileId,
            targetRole: session.setupSnapshot.targetRole,
            isSelected: contextKey === selectedContextKey,
            activeRoundCount: 0,
            completedRoundCount: 0,
            answeredQuestionCount: 0,
            coachedAnswerCount: 0,
            lastActivityAt: getSessionActivityAt(session),
            attempts: createEmptyAttemptRollup(),
        };

        if (session.status === "planned" || session.status === "in_progress") {
            current.activeRoundCount += 1;
        }
        if (session.status === "completed" && session.completionSnapshot) {
            current.completedRoundCount += 1;
        }
        const questionEvidence = createQuestionEvidenceRollup([session]);
        current.answeredQuestionCount += questionEvidence.answeredQuestionCount;
        current.coachedAnswerCount += questionEvidence.coachedAnswerCount;
        current.attempts = addAttemptRollups(current.attempts ?? createEmptyAttemptRollup(), createAttemptRollup([session]));

        const activityAt = getSessionActivityAt(session);
        if (activityAt.localeCompare(current.lastActivityAt) > 0) {
            current.lastActivityAt = activityAt;
            current.targetRole = session.setupSnapshot.targetRole;
        }

        targetInterviewsById.set(contextKey, current);
    }

    return Array.from(targetInterviewsById.values())
        .map((targetInterview) => ({
            ...targetInterview,
            isSelected: getTargetInterviewOptionContextKey(targetInterview) === selectedContextKey,
        }))
        .sort((left, right) => {
            if (left.isSelected !== right.isSelected) {
                return left.isSelected ? -1 : 1;
            }
            return right.lastActivityAt.localeCompare(left.lastActivityAt);
        });
}

function createQuestionEvidenceRollup(sessions: CandidatePracticeSessionRecord[]) {
    return sessions.reduce((rollup, session) => {
        if (session.status === "completed" && session.completionSnapshot) {
            return {
                answeredQuestionCount: rollup.answeredQuestionCount + session.completionSnapshot.answeredCount,
                coachedAnswerCount: rollup.coachedAnswerCount + session.completionSnapshot.coachedCount,
            };
        }

        const submissions = Object.entries(session.answerSubmissions).filter(([slotId, submission]) => (
            submission.slotId === slotId
        ));
        const coachedAnswerCount = submissions.filter(([slotId, submission]) => {
            const analysis = session.answerAnalysisSnapshots[slotId];
            if (
                !analysis
                || analysis.answer.slotId !== submission.slotId
                || analysis.answer.questionIndex !== submission.questionIndex
            ) {
                return false;
            }
            if (analysis.answer.answerAttemptId) {
                return analysis.answer.answerAttemptId === submission.answerAttemptId;
            }
            return !submission.attemptNumber || submission.attemptNumber === 1;
        }).length;

        return {
            answeredQuestionCount: rollup.answeredQuestionCount + submissions.length,
            coachedAnswerCount: rollup.coachedAnswerCount + coachedAnswerCount,
        };
    }, {
        answeredQuestionCount: 0,
        coachedAnswerCount: 0,
    });
}

function createAttemptRollup(sessions: CandidatePracticeSessionRecord[]): CandidateDashboardAttemptRollup {
    return sessions.reduce((rollup, session) => {
        const followUpPractice = readFollowUpPractice(session.setupSnapshot);
        const answeredQuestionKeys = new Set(Object.keys(session.answerSubmissions));
        const followUpAnsweredCount = followUpPractice
            ? followUpPractice.items.filter((item) => answeredQuestionKeys.has(item.localSlotId)).length
            : 0;

        return {
            sessionAttemptCount: rollup.sessionAttemptCount + 1,
            followUpSessionAttemptCount: rollup.followUpSessionAttemptCount + (followUpPractice ? 1 : 0),
            questionAttemptCount: rollup.questionAttemptCount + answeredQuestionKeys.size,
            followUpQuestionAttemptCount: rollup.followUpQuestionAttemptCount + followUpAnsweredCount,
        };
    }, createEmptyAttemptRollup());
}

function addAttemptRollups(
    left: CandidateDashboardAttemptRollup,
    right: CandidateDashboardAttemptRollup,
): CandidateDashboardAttemptRollup {
    return {
        sessionAttemptCount: left.sessionAttemptCount + right.sessionAttemptCount,
        followUpSessionAttemptCount: left.followUpSessionAttemptCount + right.followUpSessionAttemptCount,
        questionAttemptCount: left.questionAttemptCount + right.questionAttemptCount,
        followUpQuestionAttemptCount: left.followUpQuestionAttemptCount + right.followUpQuestionAttemptCount,
    };
}

function createEmptyAttemptRollup(): CandidateDashboardAttemptRollup {
    return {
        sessionAttemptCount: 0,
        followUpSessionAttemptCount: 0,
        questionAttemptCount: 0,
        followUpQuestionAttemptCount: 0,
    };
}

type FollowUpPracticeSnapshot = {
    items: Array<{
        localSlotId: string;
    }>;
};

function readFollowUpPractice(setupSnapshot: unknown): FollowUpPracticeSnapshot | null {
    if (!setupSnapshot || typeof setupSnapshot !== "object" || Array.isArray(setupSnapshot)) {
        return null;
    }

    const followUpPractice = (setupSnapshot as { followUpPractice?: unknown }).followUpPractice;
    if (
        !followUpPractice
        || typeof followUpPractice !== "object"
        || Array.isArray(followUpPractice)
        || (followUpPractice as { status?: unknown }).status !== "candidate_follow_up_practice_session"
        || !Array.isArray((followUpPractice as { items?: unknown }).items)
    ) {
        return null;
    }

    return {
        items: (followUpPractice as { items: unknown[] }).items.filter((item): item is { localSlotId: string } => (
            Boolean(item)
            && typeof item === "object"
            && !Array.isArray(item)
            && typeof (item as { localSlotId?: unknown }).localSlotId === "string"
        )),
    };
}

function getTargetInterviewContextKey(session: CandidatePracticeSessionRecord) {
    const roleProfileId = normalizeCandidateRoleProfileId(session.roleProfileId);
    return roleProfileId
        ? createRoleProfileContextKey(roleProfileId)
        : createLegacyTargetRoleContextKey(getLegacyTargetInterviewId(session));
}

function getTargetInterviewOptionContextKey(targetInterview: CandidateDashboardTargetInterview) {
    return targetInterview.roleProfileId
        ? createRoleProfileContextKey(targetInterview.roleProfileId)
        : createLegacyTargetRoleContextKey(targetInterview.id);
}

function getLegacyTargetInterviewId(session: CandidatePracticeSessionRecord) {
    return normalizeCandidateTargetInterviewId(session.setupSnapshot.targetRole) || "unknown-role";
}

function createRoleProfileContextKey(roleProfileId: string) {
    return `profile:${roleProfileId}`;
}

function createLegacyTargetRoleContextKey(normalizedTargetRole: string) {
    return `legacy:${normalizedTargetRole}`;
}

function getSessionActivityAt(session: CandidatePracticeSessionRecord) {
    return session.completionSnapshot?.completedAt ?? session.setupSnapshot.createdAt;
}

function createActiveRound(activeSession: CandidatePracticeSessionRecord | null): CandidateDashboardActiveRound | null {
    if (!activeSession || (activeSession.status !== "planned" && activeSession.status !== "in_progress")) {
        return null;
    }

    const questionCount = activeSession.questionWordingSnapshot?.status === "questions_worded"
        ? activeSession.questionWordingSnapshot.questions.length
        : activeSession.questionPlanSnapshot.questionCount;
    const answeredCount = Object.keys(activeSession.answerSubmissions).length;
    const currentQuestionNumber = Math.min(
        Math.max(activeSession.progress.currentQuestionIndex + 1, 1),
        Math.max(questionCount, 1),
    );

    return {
        status: "candidate_dashboard_active_round",
        candidatePracticeSessionId: activeSession.candidatePracticeSessionId,
        targetRole: activeSession.setupSnapshot.targetRole,
        sessionStatus: activeSession.status,
        href: `/candidate/session/${activeSession.candidatePracticeSessionId}`,
        questionCount,
        answeredCount,
        currentQuestionNumber,
        progressLabel: `${answeredCount} of ${questionCount} answered`,
    };
}

function createCoachingLoop({
    latestCoachUpdate,
    practiceNext,
}: {
    latestCoachUpdate: CandidateDashboardCoachUpdate | null;
    practiceNext: CandidatePracticeNext;
}): CandidateDashboardCoachingLoop {
    return {
        status: "candidate_dashboard_coaching_loop_ready",
        principle: "Use what happened in practice to choose the next useful move.",
        feedback: latestCoachUpdate ? {
            status: "candidate_dashboard_feedback_ready",
            label: "Coach Update",
            title: latestCoachUpdate.title,
            body: latestCoachUpdate.body,
            href: latestCoachUpdate.href,
            completedAt: latestCoachUpdate.completedAt,
            answeredCount: latestCoachUpdate.answeredCount,
            questionCount: latestCoachUpdate.questionCount,
            ...(latestCoachUpdate.coachingPreview
                ? {
                    questionContext: `Question ${latestCoachUpdate.coachingPreview.questionNumber} · ${latestCoachUpdate.coachingPreview.category}`,
                    observation: latestCoachUpdate.coachingPreview.observation,
                }
                : {}),
        } : null,
        feedforward: {
            status: "candidate_dashboard_feedforward_ready",
            label: "Practice Next",
            title: practiceNext.label,
            body: practiceNext.reason,
            href: practiceNext.href,
            source: practiceNext.source,
            questionKeys: practiceNext.questionKeys,
        },
    };
}

function createFirstPracticeNext(): CandidatePracticeNext {
    return {
        status: "candidate_practice_next_ready",
        source: "new_round",
        label: "Start a practice round",
        reason: "Your first completed practice round will create the evidence this dashboard uses.",
        href: "/candidate/setup",
        questionKeys: [],
    };
}

function createPracticeDirection({
    activeSession,
    latestCompletedRound,
    practiceNext,
}: {
    activeSession: CandidatePracticeSessionRecord | null;
    latestCompletedRound: CandidateCompletedRoundReadModels | null;
    practiceNext: CandidatePracticeNext;
}): CandidateDashboardPracticeDirection {
    const planProgress = createPlanProgress({
        activeSession,
        latestCompletedRound,
        practiceNext,
    });
    const coachGuidedFocus = createCoachGuidedFocus(latestCompletedRound);

    return {
        status: "candidate_dashboard_practice_direction_ready",
        primaryAction: planProgress.source === "active_round"
            ? "resume_planned_round"
            : planProgress.source === "unanswered_planned_questions"
                ? "finish_planned_coverage"
                : coachGuidedFocus
                    ? "practice_from_feedback"
                    : planProgress.source === "first_round"
                        ? "start_first_round"
                        : "start_new_round",
        planProgress,
        coachGuidedFocus,
    };
}

function createPlanProgress({
    activeSession,
    latestCompletedRound,
    practiceNext,
}: {
    activeSession: CandidatePracticeSessionRecord | null;
    latestCompletedRound: CandidateCompletedRoundReadModels | null;
    practiceNext: CandidatePracticeNext;
}): CandidateDashboardPlanProgressIndicator {
    if (activeSession) {
        const isStarted = activeSession.status === "in_progress"
            || activeSession.progress.status === "question_preview"
            || activeSession.progress.status === "live_question";

        return {
            status: "candidate_dashboard_plan_progress_ready",
            label: "Plan progress",
            source: "active_round",
            title: isStarted ? "Resume your current practice round." : "Continue the round already set up.",
            body: `${activeSession.setupSnapshot.targetRole} practice is already part of your Coach Plan. Finish that planned round before starting a different focus.`,
            href: `/candidate/session/${activeSession.candidatePracticeSessionId}`,
            questionKeys: [],
            candidatePracticeSessionId: activeSession.candidatePracticeSessionId,
        };
    }

    if (practiceNext.source === "unanswered_question") {
        return {
            status: "candidate_dashboard_plan_progress_ready",
            label: "Plan progress",
            source: "unanswered_planned_questions",
            title: practiceNext.label,
            body: practiceNext.reason,
            href: practiceNext.href,
            questionKeys: practiceNext.questionKeys,
            candidatePracticeSessionId: latestCompletedRound?.round.candidatePracticeSessionId,
        };
    }

    if (latestCompletedRound) {
        return {
            status: "candidate_dashboard_plan_progress_ready",
            label: "Plan progress",
            source: "completed_plan",
            title: "The latest round is complete.",
            body: "You answered every planned question in this round. Feedback-based practice can build on what I noticed.",
            href: null,
            questionKeys: [],
        };
    }

    return {
        status: "candidate_dashboard_plan_progress_ready",
        label: "Plan progress",
        source: "first_round",
        title: practiceNext.label,
        body: practiceNext.reason,
        href: practiceNext.href,
        questionKeys: [],
    };
}

function createCoachGuidedFocus(
    latestCompletedRound: CandidateCompletedRoundReadModels | null,
): CandidateDashboardCoachGuidedFocusIndicator | null {
    if (!latestCompletedRound) {
        return null;
    }

    const firstCoachedQuestion = latestCompletedRound.postRoundReview.questions.find((question) => question.coaching);
    if (!firstCoachedQuestion?.coaching) {
        return null;
    }

    return {
        status: "candidate_dashboard_coach_guided_focus_ready",
        label: "Practice from feedback",
        source: "coach_feedback",
        title: firstCoachedQuestion.coaching.nextPracticeFocus,
        body: "Use the latest coach feedback to choose one focused answer pattern to practice next.",
        href: createCandidateFocusedPracticeHref({
            kind: "practice_from_feedback",
            candidatePracticeSessionId: latestCompletedRound.round.candidatePracticeSessionId,
            questionKey: firstCoachedQuestion.questionKey,
        }),
        candidatePracticeSessionId: latestCompletedRound.round.candidatePracticeSessionId,
        questionKeys: [firstCoachedQuestion.questionKey],
    };
}

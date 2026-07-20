import { candidateSetupStageOptions, type CandidateSetupStageId } from "@/features/candidate-setup-v2/candidate-setup-contract";

export type RecruiterDashboardRecipientFact = {
    batchId: string;
    batchLifecycleState: "ready" | "revoked";
    targetRole: string;
    interviewStage: CandidateSetupStageId;
    batchCreatedAt: string;
    recipientId: string;
    recipientLifecycleState: "ready" | "revoked";
    candidateIndex: number;
    firstName: string;
    lastName: string;
    email: string;
    requisitionReference: string | null;
    sessionId: string;
    sessionStatus: "planned" | "in_progress" | "completed" | "abandoned";
    sessionAttemptNumber: number;
    questionCount: number;
    answeredQuestionCount: number;
    completedAt: string | null;
    deliveryLifecycleState: "queued" | "sending" | "provider_accepted" | "failed" | "outcome_unknown" | null;
    deliveryAttemptNumber: number | null;
    deliveryRetryable: boolean;
    entryMatchState: "match" | "mismatch" | null;
    firstOpenedAt: string | null;
    lastActivityAt: string;
};

export type RecruiterDashboardDeliveryState =
    | "not_requested"
    | "queued"
    | "sending"
    | "provider_accepted"
    | "failed_retryable"
    | "failed_terminal"
    | "outcome_unknown";

export type RecruiterDashboardEntryState =
    | "not_opened"
    | "opened"
    | "initials_match"
    | "initials_mismatch";

export type RecruiterDashboardPracticeState =
    | "not_started"
    | "in_progress"
    | "completed"
    | "abandoned"
    | "revoked";

export type RecruiterDashboardRecipient = RecruiterDashboardRecipientFact & {
    candidateName: string;
    interviewStageLabel: string;
    deliveryState: RecruiterDashboardDeliveryState;
    entryState: RecruiterDashboardEntryState;
    practiceState: RecruiterDashboardPracticeState;
    needsAttention: boolean;
};

export type RecruiterDashboardReadModel = {
    summary: {
        totalInvitations: number;
        notStarted: number;
        inPractice: number;
        completed: number;
        needsAttention: number;
    };
    recipients: RecruiterDashboardRecipient[];
};

export function createRecruiterDashboardReadModel(
    facts: RecruiterDashboardRecipientFact[],
): RecruiterDashboardReadModel {
    const recipients = facts.map(toRecipient).sort(compareRecipients);
    return {
        summary: {
            totalInvitations: recipients.length,
            notStarted: recipients.filter((recipient) => recipient.practiceState === "not_started").length,
            inPractice: recipients.filter((recipient) => recipient.practiceState === "in_progress").length,
            completed: recipients.filter((recipient) => recipient.practiceState === "completed").length,
            needsAttention: recipients.filter((recipient) => recipient.needsAttention).length,
        },
        recipients,
    };
}

function toRecipient(fact: RecruiterDashboardRecipientFact): RecruiterDashboardRecipient {
    if (fact.answeredQuestionCount > fact.questionCount) {
        throw new Error("Recruiter dashboard answered-question count exceeds the session question count.");
    }
    const deliveryState = resolveDeliveryState(fact);
    const entryState = fact.entryMatchState === "match"
        ? "initials_match"
        : fact.entryMatchState === "mismatch"
            ? "initials_mismatch"
            : fact.firstOpenedAt
                ? "opened"
                : "not_opened";
    const practiceState = fact.batchLifecycleState === "revoked" || fact.recipientLifecycleState === "revoked"
        ? "revoked"
        : fact.sessionStatus === "planned"
            ? "not_started"
            : fact.sessionStatus;

    return {
        ...fact,
        candidateName: `${fact.firstName} ${fact.lastName}`.trim(),
        interviewStageLabel: candidateSetupStageOptions.find((stage) => stage.id === fact.interviewStage)?.label
            ?? "Interview practice",
        deliveryState,
        entryState,
        practiceState,
        needsAttention: entryState === "initials_mismatch"
            || deliveryState === "failed_retryable"
            || deliveryState === "failed_terminal"
            || deliveryState === "outcome_unknown",
    };
}

function resolveDeliveryState(fact: RecruiterDashboardRecipientFact): RecruiterDashboardDeliveryState {
    if (!fact.deliveryLifecycleState) return "not_requested";
    if (fact.deliveryLifecycleState === "failed") {
        return fact.deliveryRetryable ? "failed_retryable" : "failed_terminal";
    }
    return fact.deliveryLifecycleState;
}

function compareRecipients(left: RecruiterDashboardRecipient, right: RecruiterDashboardRecipient) {
    if (left.needsAttention !== right.needsAttention) return left.needsAttention ? -1 : 1;
    const activityDifference = Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt);
    if (activityDifference !== 0) return activityDifference;
    const batchDifference = Date.parse(right.batchCreatedAt) - Date.parse(left.batchCreatedAt);
    if (batchDifference !== 0) return batchDifference;
    return left.candidateIndex - right.candidateIndex;
}

export type CreateInviteBatchQuestionInput = {
    text: string;
    category: string;
    index: number;
};

export type CreateInviteBatchCandidateInput = {
    firstName: string;
    lastName: string;
    email: string;
    reqId: string;
    resumeText?: string;
};

export type CreateInviteBatchInput = {
    role: string;
    jobDescription?: string;
    candidates: CreateInviteBatchCandidateInput[];
    questions: CreateInviteBatchQuestionInput[];
    createdBy: string;
    appBaseUrl: string;
    parentBatchId?: string;
};

export type InviteBatchSuccess = {
    status: "created";
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    link: string;
};

export type InviteBatchFailure = {
    status: "failed";
    firstName: string;
    lastName: string;
    email: string;
    code: "INVITE_CREATE_FAILED";
    message: string;
    retryable: boolean;
};

export type PersistedInviteBatchCandidateStatus = "pending" | "created" | "failed" | "retry_issued";

export type PersistedInviteBatchCandidate = CreateInviteBatchCandidateInput & {
    candidateIndex: number;
    status: PersistedInviteBatchCandidateStatus;
    retryable: boolean;
    retryCount: number;
    sessionId?: string;
    errorCode?: InviteBatchFailure["code"];
    errorMessage?: string;
};

export type PersistedInviteBatchStatus = "pending" | "completed" | "failed" | "retry_issued";

export type PersistedInviteBatch = {
    batchId: string;
    parentBatchId?: string;
    createdBy: string;
    role: string;
    jobDescription?: string;
    questions: CreateInviteBatchQuestionInput[];
    candidates: PersistedInviteBatchCandidate[];
    status: PersistedInviteBatchStatus;
};

export type InviteBatchSummary = {
    requested: number;
    succeeded: number;
    failed: number;
    hasFailures: boolean;
};

export type CreateInviteBatchResult = {
    batchId: string;
    retriedFromBatchId?: string;
    results: InviteBatchSuccess[];
    failures: InviteBatchFailure[];
    summary: InviteBatchSummary;
};

export type RetryInviteBatchResult = CreateInviteBatchResult;

export type InviteEmailInput = {
    recipientEmails: string[];
    recipientFirstName: string;
    role: string;
    inviteLink: string;
    recruiterName: string;
    recruiterTitle?: string;
    recruiterCompany?: string;
    recruiterPhone?: string;
    recruiterEmail?: string;
};

export type SendInviteEmailInput = InviteEmailInput & {
    actorId: string;
    sessionIds?: string[];
};

export type ResendInviteEmailInput = {
    actorId: string;
    sessionId: string;
    recruiterName: string;
    recruiterTitle?: string;
    recruiterCompany?: string;
    recruiterPhone?: string;
    recruiterEmail?: string;
    requestUrl?: string;
};

export type InviteEmailResult = {
    id?: string | null;
} | undefined;

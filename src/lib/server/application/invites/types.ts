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

export type InviteBatchSummary = {
    requested: number;
    succeeded: number;
    failed: number;
    hasFailures: boolean;
};

export type CreateInviteBatchResult = {
    results: InviteBatchSuccess[];
    failures: InviteBatchFailure[];
    summary: InviteBatchSummary;
};

export interface Invite {
    id: string; // Internal ID
    token: string; // The secret part of the URL (e.g. s/[token])
    role: string;
    jobDescription?: string;

    // UF-R1 Additions
    candidate: {
        firstName: string;
        lastName: string;
        email: string;
        reqId: string;
        resumeText?: string;
    };
    questions: Array<{
        text: string;
        category: string; // STAR, PERMA, Technical, Other
        index: number;
    }>;

    createdBy: string; // Recruiter ID
    createdAt: number;
}

export interface InviteRepository {
    create(invite: Invite): Promise<void>;
    createBatch(invites: Invite[]): Promise<void>;
    getByToken(token: string): Promise<Invite | null>;
}

import type { ResolveCandidateProfileInput } from "./candidate-profile-repository";

export type CandidateAuthAdapterSource =
    | "talentarbor"
    | "rangamworks"
    | "password"
    | "mock"
    | "static";

export type CandidateAuthHandoff = ResolveCandidateProfileInput;

export type CandidateAuthAdapter = {
    source: CandidateAuthAdapterSource;
    resolveIdentity(): Promise<CandidateAuthHandoff | null>;
};

export function toCandidateProfileResolutionInput(handoff: CandidateAuthHandoff): ResolveCandidateProfileInput {
    const issuer = handoff.issuer.trim();
    const subject = handoff.subject.trim();
    const email = handoff.email.trim().toLowerCase();

    if (!issuer) {
        throw new Error("Candidate auth handoff issuer is required.");
    }
    if (!subject) {
        throw new Error("Candidate auth handoff subject is required.");
    }
    if (!email) {
        throw new Error("Candidate auth handoff email is required.");
    }

    return {
        provider: handoff.provider,
        issuer,
        subject,
        email,
        displayName: handoff.displayName?.trim() || null,
        workspace: handoff.workspace,
    };
}

export function createStaticCandidateAuthAdapter(handoff: CandidateAuthHandoff | null): CandidateAuthAdapter {
    return {
        source: "static",
        async resolveIdentity() {
            return handoff ? toCandidateProfileResolutionInput(handoff) : null;
        },
    };
}

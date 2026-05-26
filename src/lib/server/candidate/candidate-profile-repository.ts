import type { QueryResultRow } from "pg";

import { queryPostgres } from "@/lib/server/db/postgres";

export type CandidateWorkspace = "rangamworks" | "talentarbor" | "local_dev";
export type CandidateIdentityProvider = "rangamworks_sso" | "talentarbor_login" | "password" | "dev_mock";

export type CandidateIdentityLookup = {
    provider: CandidateIdentityProvider;
    issuer: string;
    subject: string;
};

export type ResolveCandidateProfileInput = CandidateIdentityLookup & {
    email: string;
    displayName?: string | null;
    workspace: CandidateWorkspace;
};

export type CandidateProfileAccessRecord = {
    candidateProfileId: string;
    authSubject: string;
    email: string;
    displayName: string | null;
    workspace: CandidateWorkspace;
    provider: CandidateIdentityProvider;
    issuer: string;
    subject: string;
};

type CandidateProfileIdentityRow = QueryResultRow & {
    candidate_profile_id: string;
    auth_subject: string;
    email: string;
    display_name: string | null;
    workspace: CandidateWorkspace;
    provider: CandidateIdentityProvider;
    issuer: string;
    subject: string;
};

export async function findCandidateProfileByIdentity(
    identity: CandidateIdentityLookup
): Promise<CandidateProfileAccessRecord | null> {
    const normalized = normalizeIdentity(identity);
    const result = await queryPostgres<CandidateProfileIdentityRow>(
        `
            select
                p.candidate_profile_id,
                p.auth_subject,
                p.email,
                p.display_name,
                p.workspace,
                i.provider,
                i.issuer,
                i.subject
            from public.candidate_identities i
            join public.candidate_profiles p on p.candidate_profile_id = i.candidate_profile_id
            where i.provider = $1
              and i.issuer = $2
              and i.subject = $3
              and p.status = 'active'
            limit 1
        `,
        [normalized.provider, normalized.issuer, normalized.subject]
    );

    return result.rows[0] ? mapCandidateProfileAccessRow(result.rows[0]) : null;
}

export async function resolveCandidateProfileFromIdentity(
    input: ResolveCandidateProfileInput
): Promise<CandidateProfileAccessRecord> {
    const normalized = normalizeResolveInput(input);
    const authSubject = buildCandidateAuthSubject(normalized);
    const result = await queryPostgres<CandidateProfileIdentityRow>(
        `
            with profile as (
                insert into public.candidate_profiles (
                    auth_subject,
                    email,
                    display_name,
                    workspace
                )
                values ($1, $2, $3, $4)
                on conflict (auth_subject)
                do update set
                    email = excluded.email,
                    display_name = excluded.display_name,
                    workspace = excluded.workspace
                returning candidate_profile_id, auth_subject, email, display_name, workspace
            ),
            identity as (
                insert into public.candidate_identities (
                    candidate_profile_id,
                    provider,
                    issuer,
                    subject,
                    email,
                    last_seen_at
                )
                select candidate_profile_id, $5, $6, $7, email, now()
                from profile
                on conflict (provider, issuer, subject)
                do update set
                    candidate_profile_id = excluded.candidate_profile_id,
                    email = excluded.email,
                    last_seen_at = now()
                returning candidate_profile_id, provider, issuer, subject
            )
            select
                p.candidate_profile_id,
                p.auth_subject,
                p.email,
                p.display_name,
                p.workspace,
                i.provider,
                i.issuer,
                i.subject
            from profile p
            join identity i on i.candidate_profile_id = p.candidate_profile_id
            limit 1
        `,
        [
            authSubject,
            normalized.email,
            normalized.displayName,
            normalized.workspace,
            normalized.provider,
            normalized.issuer,
            normalized.subject,
        ]
    );

    return mapCandidateProfileAccessRow(result.rows[0]);
}

export function buildCandidateAuthSubject(identity: CandidateIdentityLookup): string {
    const normalized = normalizeIdentity(identity);
    return `${normalized.provider}:${normalized.issuer}:${normalized.subject}`;
}

function normalizeResolveInput(input: ResolveCandidateProfileInput): Required<ResolveCandidateProfileInput> {
    const identity = normalizeIdentity(input);
    const email = input.email.trim().toLowerCase();
    if (!email) {
        throw new Error("Candidate email is required.");
    }

    return {
        ...identity,
        email,
        displayName: input.displayName?.trim() || null,
        workspace: input.workspace,
    };
}

function normalizeIdentity(identity: CandidateIdentityLookup): CandidateIdentityLookup {
    const issuer = identity.issuer.trim();
    const subject = identity.subject.trim();

    if (!issuer) {
        throw new Error("Candidate identity issuer is required.");
    }
    if (!subject) {
        throw new Error("Candidate identity subject is required.");
    }

    return {
        provider: identity.provider,
        issuer,
        subject,
    };
}

function mapCandidateProfileAccessRow(row: CandidateProfileIdentityRow): CandidateProfileAccessRecord {
    return {
        candidateProfileId: row.candidate_profile_id,
        authSubject: row.auth_subject,
        email: row.email,
        displayName: row.display_name,
        workspace: row.workspace,
        provider: row.provider,
        issuer: row.issuer,
        subject: row.subject,
    };
}

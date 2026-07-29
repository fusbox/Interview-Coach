import type { AppAuthQueryClient } from "@/features/app-auth-v2/app-auth-postgres-runtime";
import { createAppAuthQueryClientFromEnv } from "@/features/app-auth-v2/app-auth-postgres-runtime";

import { CANDIDATE_POLICY_LINKS } from "./candidate-policy-manifest";

export type CandidateRegistrationPersistenceInput = {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phoneE164: string;
    postalCode: string;
    contactPreferences: {
        email: boolean;
        sms: boolean;
        phone: boolean;
    };
    contactAuthorization: boolean;
    termsVersion: string;
    privacyVersion: string;
    cookieVersion: string;
    responsibleAiVersion: string;
    contactAuthorizationVersion: string;
    verificationTokenHash: string;
    verificationExpiresAt: string;
    ipAddress: string | null;
    userAgent: string | null;
};

export type CandidateRegistrationPersistenceResult =
    | {
        outcome: "created";
        userId: string;
        candidateProfileId: string;
        tokenId: string;
    }
    | { outcome: "exists" };

export type CandidateVerificationIssueResult =
    | { outcome: "issued"; userId: string; tokenId: string; firstName: string | null }
    | { outcome: "ignored" | "cooldown" };

export type CandidateVerificationConsumeResult =
    | { outcome: "verified" | "already_verified"; userId: string }
    | { outcome: "expired" | "invalid" };

export class CandidateAccountRepository {
    constructor(
        private readonly client: AppAuthQueryClient = createAppAuthQueryClientFromEnv(),
    ) {}

    async register(
        input: CandidateRegistrationPersistenceInput,
    ): Promise<CandidateRegistrationPersistenceResult> {
        const result = await this.client.query(`
            select *
            from public.register_candidate_app_account_v2(
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18,
              $19, $20, $21, $22, $23
            )
        `, [
            input.email,
            input.passwordHash,
            input.firstName,
            input.lastName,
            input.phoneE164,
            input.postalCode,
            input.contactPreferences.email,
            input.contactPreferences.sms,
            input.contactPreferences.phone,
            input.contactAuthorization,
            input.termsVersion,
            CANDIDATE_POLICY_LINKS.terms,
            input.privacyVersion,
            CANDIDATE_POLICY_LINKS.privacy,
            input.cookieVersion,
            CANDIDATE_POLICY_LINKS.cookie,
            input.responsibleAiVersion,
            CANDIDATE_POLICY_LINKS.responsibleAi,
            input.contactAuthorizationVersion,
            input.verificationTokenHash,
            input.verificationExpiresAt,
            input.ipAddress,
            input.userAgent,
        ]);
        const row = result.rows[0];
        if (row?.registration_outcome === "exists") return { outcome: "exists" };
        if (row?.registration_outcome !== "created") {
            throw new Error("Candidate registration returned an unsupported outcome.");
        }
        return {
            outcome: "created",
            userId: requireString(row.registered_user_id, "registered_user_id"),
            candidateProfileId: requireString(
                row.registered_candidate_profile_id,
                "registered_candidate_profile_id",
            ),
            tokenId: requireString(row.verification_token_id, "verification_token_id"),
        };
    }

    async issueVerification(input: {
        email: string;
        tokenHash: string;
        expiresAt: string;
    }): Promise<CandidateVerificationIssueResult> {
        const result = await this.client.query(`
            select *
            from public.issue_candidate_email_verification_v1($1, $2, $3)
        `, [input.email, input.tokenHash, input.expiresAt]);
        const row = result.rows[0];
        if (row?.issue_outcome === "ignored" || row?.issue_outcome === "cooldown") {
            return { outcome: row.issue_outcome };
        }
        if (row?.issue_outcome !== "issued") {
            throw new Error("Candidate verification issuance returned an unsupported outcome.");
        }
        return {
            outcome: "issued",
            userId: requireString(row.issued_user_id, "issued_user_id"),
            tokenId: requireString(row.issued_token_id, "issued_token_id"),
            firstName: readOptionalString(row.issued_first_name),
        };
    }

    async invalidateVerification(tokenHash: string): Promise<void> {
        await this.client.query(
            "select public.invalidate_candidate_email_verification_v1($1)",
            [tokenHash],
        );
    }

    async consumeVerification(tokenHash: string): Promise<CandidateVerificationConsumeResult> {
        const result = await this.client.query(`
            select *
            from public.consume_candidate_email_verification_v1($1)
        `, [tokenHash]);
        const row = result.rows[0];
        if (row?.verification_outcome === "verified" || row?.verification_outcome === "already_verified") {
            return {
                outcome: row.verification_outcome,
                userId: requireString(row.verified_user_id, "verified_user_id"),
            };
        }
        if (row?.verification_outcome === "expired" || row?.verification_outcome === "invalid") {
            return { outcome: row.verification_outcome };
        }
        throw new Error("Candidate verification consumption returned an unsupported outcome.");
    }

    async recordEmailDelivery(input: {
        userId: string;
        outcome: "success" | "failed";
        provider: string;
        reason: string;
    }): Promise<void> {
        await this.client.query(`
            insert into public.auth_audit_events (
              user_id,
              event_type,
              outcome,
              metadata
            )
            values ($1, 'candidate_verification_email', $2, $3::jsonb)
        `, [
            input.userId,
            input.outcome,
            JSON.stringify({
                provider: input.provider,
                reason: input.reason,
            }),
        ]);
    }
}

function requireString(value: unknown, field: string): string {
    if (typeof value !== "string" || !value) {
        throw new Error(`Candidate account query returned invalid ${field}.`);
    }
    return value;
}

function readOptionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

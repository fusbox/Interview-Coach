import type { AppAuthQueryClient } from "@/features/app-auth-v2/app-auth-postgres-runtime";
import { createAppAuthQueryClientFromEnv } from "@/features/app-auth-v2/app-auth-postgres-runtime";

export type CandidatePasswordResetIssueResult =
    | { outcome: "issued"; userId: string; tokenId: string; firstName: string | null }
    | { outcome: "ignored" | "cooldown" };

export type CandidatePasswordResetConsumeResult =
    | { outcome: "reset"; userId: string; revokedSessionCount: number }
    | { outcome: "expired" }
    | { outcome: "invalid" };

export class CandidatePasswordRecoveryRepository {
    constructor(
        private readonly client: AppAuthQueryClient = createAppAuthQueryClientFromEnv(),
    ) {}

    async issue(input: {
        email: string;
        tokenHash: string;
        expiresAt: string;
    }): Promise<CandidatePasswordResetIssueResult> {
        const result = await this.client.query(`
            select *
            from public.issue_candidate_password_reset_v1($1, $2, $3)
        `, [input.email, input.tokenHash, input.expiresAt]);
        const row = result.rows[0];
        if (row?.issue_outcome === "ignored" || row?.issue_outcome === "cooldown") {
            return { outcome: row.issue_outcome };
        }
        if (row?.issue_outcome !== "issued") {
            throw new Error("Candidate password reset issuance returned an unsupported outcome.");
        }
        return {
            outcome: "issued",
            userId: requireString(row.issued_user_id, "issued_user_id"),
            tokenId: requireString(row.issued_token_id, "issued_token_id"),
            firstName: readOptionalString(row.issued_first_name),
        };
    }

    async invalidate(tokenHash: string): Promise<void> {
        await this.client.query(
            "select public.invalidate_candidate_password_reset_v1($1)",
            [tokenHash],
        );
    }

    async consume(input: {
        tokenHash: string;
        passwordHash: string;
        ipAddress: string | null;
        userAgent: string | null;
    }): Promise<CandidatePasswordResetConsumeResult> {
        const result = await this.client.query(`
            select *
            from public.consume_candidate_password_reset_v1($1, $2, $3, $4)
        `, [
            input.tokenHash,
            input.passwordHash,
            input.ipAddress,
            input.userAgent,
        ]);
        const row = result.rows[0];
        if (row?.reset_outcome === "reset") {
            return {
                outcome: "reset",
                userId: requireString(row.reset_user_id, "reset_user_id"),
                revokedSessionCount: readNonnegativeInteger(row.revoked_session_count),
            };
        }
        if (row?.reset_outcome === "expired" || row?.reset_outcome === "invalid") {
            return { outcome: row.reset_outcome };
        }
        throw new Error("Candidate password reset consumption returned an unsupported outcome.");
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
            values ($1, 'candidate_password_reset_email', $2, $3::jsonb)
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
        throw new Error(`Candidate password recovery query returned invalid ${field}.`);
    }
    return value;
}

function readOptionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNonnegativeInteger(value: unknown): number {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : 0;
}

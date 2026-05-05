import type { AppRole, AppUser } from "@/lib/auth/user";

export type PasswordCredentialRecord = {
    user: AppUser;
    passwordHash: string;
    failedLoginCount: number;
    lockedUntil: string | null;
};

export type CreateAppSessionParams = {
    userId: string;
    sessionTokenHash: string;
    expiresAt: string;
    userAgent?: string | null;
    ipAddress?: string | null;
};

export type AuthAuditOutcome = "success" | "failed";

export type AuthAuditEvent = {
    userId?: string | null;
    eventType: string;
    outcome: AuthAuditOutcome;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
};

export interface AppAuthStore {
    findPasswordCredentialByEmail(email: string): Promise<PasswordCredentialRecord | null>;
    findUserBySessionTokenHash(sessionTokenHash: string): Promise<AppUser | null>;
    createSession(params: CreateAppSessionParams): Promise<void>;
    revokeSession(sessionTokenHash: string): Promise<void>;
    recordAuditEvent(event: AuthAuditEvent): Promise<void>;
}

export function normalizeAuthEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function normalizeRoles(roles: unknown): AppRole[] {
    if (!Array.isArray(roles)) {
        return [];
    }

    return roles.filter((role): role is AppRole => (
        role === "recruiter" || role === "admin" || role === "qa"
    ));
}


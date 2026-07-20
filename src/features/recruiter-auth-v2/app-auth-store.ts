import type { AppRole, AppUser } from "./app-user";

export type PasswordCredentialRecord = {
    user: AppUser;
    passwordHash: string;
    failedLoginCount: number;
    lockedUntil: string | null;
};

export type CreateAppSessionInput = {
    userId: string;
    sessionTokenHash: string;
    expiresAt: string;
    userAgent?: string | null;
    ipAddress?: string | null;
};

export type AuthAuditEvent = {
    userId?: string | null;
    eventType: "login" | "logout" | "authorization";
    outcome: "success" | "failed";
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
};

export interface AppAuthStore {
    findPasswordCredentialByEmail(email: string): Promise<PasswordCredentialRecord | null>;
    findUserBySessionTokenHash(sessionTokenHash: string): Promise<AppUser | null>;
    createSession(input: CreateAppSessionInput): Promise<void>;
    revokeSession(sessionTokenHash: string): Promise<string | null>;
    recordPasswordFailure(userId: string): Promise<void>;
    clearPasswordFailures(userId: string): Promise<void>;
    recordAuditEvent(event: AuthAuditEvent): Promise<void>;
}

export function normalizeAuthEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function normalizeAppRoles(value: unknown): AppRole[] {
    if (!Array.isArray(value)) return [];
    return value.filter((role): role is AppRole => (
        role === "recruiter" || role === "admin" || role === "qa"
    ));
}

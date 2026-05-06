import type { AppUser } from "@/lib/auth/user";
import { Logger } from "@/lib/logger";
import {
    generateAppSessionToken,
    getAppSessionExpiresAt,
    hashAppSessionToken,
} from "./app-session";
import { type AppAuthStore } from "./app-auth-store";
import { PostgresAppAuthStore } from "./postgres-app-auth-store";
import { verifyPassword } from "./password";
export { getAppAuthBackendName } from "./app-auth-config";
export type { AppAuthBackendName } from "./app-auth-config";

const LOCKED_LOGIN_MESSAGE = "Account is locked. Please try again later or contact an administrator.";
const INVALID_LOGIN_MESSAGE = "Invalid email or password.";
const DISABLED_LOGIN_MESSAGE = "Account is not active.";

export type LoginMetadata = {
    userAgent?: string | null;
    ipAddress?: string | null;
};

export type LoginResult =
    | {
        ok: true;
        user: AppUser;
        sessionToken: string;
        expiresAt: string;
    }
    | {
        ok: false;
        status: 401 | 403 | 423;
        error: string;
    };

export type AppAuthDependencies = {
    store?: AppAuthStore;
};

export async function authenticateWithPassword(
    email: string,
    password: string,
    metadata: LoginMetadata = {},
    dependencies: AppAuthDependencies = {}
): Promise<LoginResult> {
    const store = dependencies.store ?? new PostgresAppAuthStore();
    const credential = await store.findPasswordCredentialByEmail(email);

    if (!credential) {
        await recordLoginAudit(store, {
            outcome: "failed",
            metadata: { reason: "unknown_user" },
            ...metadata,
        });
        return { ok: false, status: 401, error: INVALID_LOGIN_MESSAGE };
    }

    if (credential.lockedUntil && Date.parse(credential.lockedUntil) > Date.now()) {
        await recordLoginAudit(store, {
            userId: credential.user.id,
            outcome: "failed",
            metadata: { reason: "locked" },
            ...metadata,
        });
        return { ok: false, status: 423, error: LOCKED_LOGIN_MESSAGE };
    }

    if (credential.user.status !== "active") {
        await recordLoginAudit(store, {
            userId: credential.user.id,
            outcome: "failed",
            metadata: { reason: "inactive_user", status: credential.user.status },
            ...metadata,
        });
        return { ok: false, status: 403, error: DISABLED_LOGIN_MESSAGE };
    }

    const passwordMatches = await verifyPassword(password, credential.passwordHash);
    if (!passwordMatches) {
        await recordLoginAudit(store, {
            userId: credential.user.id,
            outcome: "failed",
            metadata: { reason: "bad_password" },
            ...metadata,
        });
        return { ok: false, status: 401, error: INVALID_LOGIN_MESSAGE };
    }

    const sessionToken = generateAppSessionToken();
    const expiresAt = getAppSessionExpiresAt().toISOString();
    await store.createSession({
        userId: credential.user.id,
        sessionTokenHash: hashAppSessionToken(sessionToken),
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
    });
    await recordLoginAudit(store, {
        userId: credential.user.id,
        outcome: "success",
        metadata: { reason: "password_login" },
        ...metadata,
    });

    return {
        ok: true,
        user: credential.user,
        sessionToken,
        expiresAt,
    };
}

export async function getUserBySessionToken(
    sessionToken: string | undefined,
    dependencies: AppAuthDependencies = {}
): Promise<AppUser | null> {
    if (!sessionToken) {
        return null;
    }

    const store = dependencies.store ?? new PostgresAppAuthStore();
    return store.findUserBySessionTokenHash(hashAppSessionToken(sessionToken));
}

export async function revokeAppSession(
    sessionToken: string | undefined,
    dependencies: AppAuthDependencies = {}
): Promise<void> {
    if (!sessionToken) {
        return;
    }

    const store = dependencies.store ?? new PostgresAppAuthStore();
    await store.revokeSession(hashAppSessionToken(sessionToken));
}

async function recordLoginAudit(
    store: AppAuthStore,
    event: {
        userId?: string | null;
        outcome: "success" | "failed";
        userAgent?: string | null;
        ipAddress?: string | null;
        metadata?: Record<string, unknown>;
    }
) {
    try {
        await store.recordAuditEvent({
            userId: event.userId,
            eventType: "login",
            outcome: event.outcome,
            userAgent: event.userAgent,
            ipAddress: event.ipAddress,
            metadata: event.metadata,
        });
    } catch (error) {
        Logger.warn("[AppAuth] Failed to record auth audit event", { error }, "AppAuth");
    }
}

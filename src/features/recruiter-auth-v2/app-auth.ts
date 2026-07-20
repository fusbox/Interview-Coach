import type { AppUser } from "./app-user";
import {
    generateAppSessionToken,
    getAppSessionExpiresAt,
    hashAppSessionToken,
} from "./app-session";
import type { AppAuthStore, AuthAuditEvent } from "./app-auth-store";
import { PostgresAppAuthStore } from "./postgres-app-auth-store";
import { verifyPassword } from "./password";

const INVALID_LOGIN_MESSAGE = "Invalid email or password.";
const DUMMY_PASSWORD_HASH = "scrypt$16384$8$1$recruiter-auth-dummy-v1$xIy3duaUM_odQUNPcuRAMFWUlWhpCUay4Ge5dwrpzsYzOCJcTtVPol9AN05khyfMCNe67vyjJA55foZcbDeZiQ";

export type LoginMetadata = {
    userAgent?: string | null;
    ipAddress?: string | null;
};

export type LoginResult =
    | { ok: true; user: AppUser; sessionToken: string; expiresAt: string }
    | { ok: false; status: 401; error: string };

export type AppAuthDependencies = {
    store?: AppAuthStore;
    now?: () => Date;
    sessionToken?: () => string;
};

export async function authenticateWithPassword(
    email: string,
    password: string,
    metadata: LoginMetadata = {},
    dependencies: AppAuthDependencies = {},
): Promise<LoginResult> {
    const store = dependencies.store ?? new PostgresAppAuthStore();
    const credential = await store.findPasswordCredentialByEmail(email);

    if (!credential) {
        await verifyPassword(password, DUMMY_PASSWORD_HASH);
        await recordAuditSafely(store, {
            eventType: "login",
            outcome: "failed",
            metadata: { reason: "unknown_user" },
            ...metadata,
        });
        return invalidLogin();
    }

    const now = dependencies.now?.() ?? new Date();
    const matches = await verifyPassword(password, credential.passwordHash);
    if (credential.lockedUntil && Date.parse(credential.lockedUntil) > now.valueOf()) {
        await recordAuditSafely(store, {
            userId: credential.user.id,
            eventType: "login",
            outcome: "failed",
            metadata: { reason: "locked" },
            ...metadata,
        });
        return invalidLogin();
    }

    if (credential.user.status !== "active") {
        await recordAuditSafely(store, {
            userId: credential.user.id,
            eventType: "login",
            outcome: "failed",
            metadata: { reason: "inactive_user", status: credential.user.status },
            ...metadata,
        });
        return invalidLogin();
    }

    if (!matches) {
        await store.recordPasswordFailure(credential.user.id);
        await recordAuditSafely(store, {
            userId: credential.user.id,
            eventType: "login",
            outcome: "failed",
            metadata: { reason: "bad_password" },
            ...metadata,
        });
        return invalidLogin();
    }

    const sessionToken = dependencies.sessionToken?.() ?? generateAppSessionToken();
    const expiresAt = getAppSessionExpiresAt(now).toISOString();
    await store.clearPasswordFailures(credential.user.id);
    await store.createSession({
        userId: credential.user.id,
        sessionTokenHash: hashAppSessionToken(sessionToken),
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
    });
    await recordAuditSafely(store, {
        userId: credential.user.id,
        eventType: "login",
        outcome: "success",
        metadata: { reason: "password_login" },
        ...metadata,
    });

    return { ok: true, user: credential.user, sessionToken, expiresAt };
}

export async function getUserBySessionToken(
    sessionToken: string | undefined,
    dependencies: AppAuthDependencies = {},
): Promise<AppUser | null> {
    if (!sessionToken) return null;
    const store = dependencies.store ?? new PostgresAppAuthStore();
    return store.findUserBySessionTokenHash(hashAppSessionToken(sessionToken));
}

export async function revokeAppSession(
    sessionToken: string | undefined,
    metadata: LoginMetadata = {},
    dependencies: AppAuthDependencies = {},
): Promise<void> {
    if (!sessionToken) return;
    const store = dependencies.store ?? new PostgresAppAuthStore();
    const userId = await store.revokeSession(hashAppSessionToken(sessionToken));
    await recordAuditSafely(store, {
        userId,
        eventType: "logout",
        outcome: "success",
        metadata: { reason: "user_logout" },
        ...metadata,
    });
}

async function recordAuditSafely(store: AppAuthStore, event: AuthAuditEvent): Promise<void> {
    try {
        await store.recordAuditEvent(event);
    } catch {
        // Authentication remains available when non-authoritative audit telemetry is degraded.
    }
}

function invalidLogin(): LoginResult {
    return { ok: false, status: 401, error: INVALID_LOGIN_MESSAGE };
}

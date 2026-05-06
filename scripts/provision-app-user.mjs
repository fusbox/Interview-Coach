#!/usr/bin/env node
import { randomBytes, scrypt } from "node:crypto";
import { Pool } from "pg";

const VALID_ROLES = new Set(["recruiter", "admin", "qa"]);
const VALID_STATUSES = new Set(["active", "invited", "disabled"]);
const DEFAULT_PASSWORD_ENV = "APP_USER_PASSWORD";
const MIN_PASSWORD_LENGTH = 12;
const PASSWORD_HASH_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printUsage();
        return;
    }

    const passwordEnvName = options.passwordEnv ?? DEFAULT_PASSWORD_ENV;
    const password = options.password ?? process.env[passwordEnvName];
    validateProvisionOptions(options, password, passwordEnvName);

    const pool = new Pool(getPostgresPoolConfig(process.env));
    try {
        const result = await provisionAppUser(pool, options, password);
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await pool.end();
    }
}

function parseArgs(args) {
    const options = {
        roles: ["recruiter"],
        status: "active",
        timezone: "UTC",
        verifyEmail: true,
        allowWeakPassword: false,
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--help" || arg === "-h") {
            options.help = true;
            continue;
        }

        if (!arg.startsWith("--")) {
            throw new Error(`Unexpected positional argument "${arg}".`);
        }

        const optionText = arg.slice(2);
        const equalsIndex = optionText.indexOf("=");
        const rawName = equalsIndex === -1 ? optionText : optionText.slice(0, equalsIndex);
        const inlineValue = equalsIndex === -1 ? undefined : optionText.slice(equalsIndex + 1);
        const name = camelCase(rawName);
        const booleanFlags = new Set(["noVerifyEmail", "allowWeakPassword"]);
        const value = inlineValue ?? (booleanFlags.has(name) ? "true" : args[++index]);
        if (value === undefined) {
            throw new Error(`Missing value for --${rawName}.`);
        }

        switch (name) {
            case "email":
            case "password":
            case "passwordEnv":
            case "firstName":
            case "lastName":
            case "displayName":
            case "title":
            case "phone":
            case "timezone":
            case "status":
                options[name] = value;
                break;
            case "roles":
                options.roles = value.split(",").map((role) => role.trim().toLowerCase()).filter(Boolean);
                break;
            case "noVerifyEmail":
                options.verifyEmail = false;
                break;
            case "allowWeakPassword":
                options.allowWeakPassword = true;
                break;
            default:
                throw new Error(`Unknown option --${rawName}.`);
        }
    }

    return options;
}

function camelCase(value) {
    return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function validateProvisionOptions(options, password, passwordEnvName) {
    if (!options.email || !isValidEmail(options.email)) {
        throw new Error("Provide a valid --email value.");
    }

    if (!password) {
        throw new Error(`Set ${passwordEnvName} or pass --password for the initial credential.`);
    }

    if (!options.allowWeakPassword && password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters. Use --allow-weak-password only for disposable local test users.`);
    }

    if (!Array.isArray(options.roles) || options.roles.length === 0) {
        throw new Error("Provide at least one role with --roles recruiter,admin,qa.");
    }

    const invalidRoles = options.roles.filter((role) => !VALID_ROLES.has(role));
    if (invalidRoles.length > 0) {
        throw new Error(`Unsupported role(s): ${invalidRoles.join(", ")}. Expected recruiter, admin, or qa.`);
    }

    if (!VALID_STATUSES.has(options.status)) {
        throw new Error(`Unsupported status "${options.status}". Expected active, invited, or disabled.`);
    }
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function provisionAppUser(pool, options, password) {
    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
        await client.query("begin");

        const user = await upsertAppUser(client, options);
        await upsertPasswordCredential(client, user.user_id, passwordHash);
        await replaceRoles(client, user.user_id, options.roles);

        let profileSeeded = false;
        if (options.roles.includes("recruiter")) {
            await upsertRecruiterProfile(client, user.user_id, options);
            profileSeeded = true;
        }

        await client.query(
            `
                insert into public.auth_audit_events (
                    user_id,
                    event_type,
                    outcome,
                    metadata
                )
                values ($1, 'user_provisioned', 'success', $2::jsonb)
            `,
            [
                user.user_id,
                JSON.stringify({
                    source: "scripts/provision-app-user.mjs",
                    roles: options.roles,
                    status: options.status,
                    password_updated: true,
                    profile_seeded: profileSeeded,
                }),
            ]
        );

        await client.query("commit");

        return {
            userId: user.user_id,
            email: user.email,
            status: options.status,
            roles: options.roles,
            profileSeeded,
            passwordUpdated: true,
        };
    } catch (error) {
        await client.query("rollback");
        throw error;
    } finally {
        client.release();
    }
}

async function upsertAppUser(client, options) {
    const email = normalizeEmail(options.email);
    const existing = await client.query(
        `
            select user_id, email
            from public.app_users
            where lower(email) = $1
            limit 1
            for update
        `,
        [email]
    );

    if (existing.rows[0]) {
        const updated = await client.query(
            `
                update public.app_users
                set
                    email = $2,
                    display_name = $3,
                    first_name = $4,
                    last_name = $5,
                    status = $6,
                    email_verified_at = case
                        when $7::boolean then coalesce(email_verified_at, now())
                        else email_verified_at
                    end
                where user_id = $1
                returning user_id, email
            `,
            [
                existing.rows[0].user_id,
                email,
                options.displayName ?? null,
                options.firstName ?? null,
                options.lastName ?? null,
                options.status,
                options.verifyEmail,
            ]
        );
        return updated.rows[0];
    }

    const inserted = await client.query(
        `
            insert into public.app_users (
                email,
                display_name,
                first_name,
                last_name,
                status,
                email_verified_at
            )
            values ($1, $2, $3, $4, $5, case when $6::boolean then now() else null end)
            returning user_id, email
        `,
        [
            email,
            options.displayName ?? null,
            options.firstName ?? null,
            options.lastName ?? null,
            options.status,
            options.verifyEmail,
        ]
    );
    return inserted.rows[0];
}

async function upsertPasswordCredential(client, userId, passwordHash) {
    await client.query(
        `
            insert into public.app_user_credentials (
                user_id,
                password_hash,
                password_updated_at,
                failed_login_count,
                locked_until
            )
            values ($1, $2, now(), 0, null)
            on conflict (user_id)
            do update set
                password_hash = excluded.password_hash,
                password_updated_at = now(),
                failed_login_count = 0,
                locked_until = null
        `,
        [userId, passwordHash]
    );
}

async function replaceRoles(client, userId, roles) {
    await client.query(
        "delete from public.app_user_roles where user_id = $1 and role <> all($2::text[])",
        [userId, roles]
    );

    for (const role of roles) {
        await client.query(
            `
                insert into public.app_user_roles (user_id, role)
                values ($1, $2)
                on conflict (user_id, role) do nothing
            `,
            [userId, role]
        );
    }
}

async function upsertRecruiterProfile(client, userId, options) {
    await client.query(
        `
            insert into public.recruiter_profiles (
                recruiter_id,
                first_name,
                last_name,
                title,
                phone,
                timezone
            )
            values ($1, $2, $3, $4, $5, $6)
            on conflict (recruiter_id)
            do update set
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                title = excluded.title,
                phone = excluded.phone,
                timezone = excluded.timezone
        `,
        [
            userId,
            options.firstName ?? null,
            options.lastName ?? null,
            options.title ?? null,
            options.phone ?? null,
            options.timezone ?? "UTC",
        ]
    );
}

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

async function hashPassword(password) {
    const salt = randomBytes(SALT_BYTES).toString("base64url");
    const derivedKey = await derivePasswordKey(password, salt);

    return [
        PASSWORD_HASH_PREFIX,
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        salt,
        derivedKey.toString("base64url"),
    ].join("$");
}

function derivePasswordKey(password, salt) {
    return new Promise((resolve, reject) => {
        scrypt(password, salt, SCRYPT_KEY_LENGTH, {
            N: SCRYPT_N,
            r: SCRYPT_R,
            p: SCRYPT_P,
        }, (error, derivedKey) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(derivedKey);
        });
    });
}

function getPostgresPoolConfig(env) {
    const databaseUrl = readOptionalEnv(env, "DATABASE_URL");
    const shared = {
        max: parsePositiveInt(readOptionalEnv(env, "POSTGRES_POOL_MAX"), 2, "POSTGRES_POOL_MAX"),
        idleTimeoutMillis: parsePositiveInt(readOptionalEnv(env, "POSTGRES_IDLE_TIMEOUT_MS"), 30_000, "POSTGRES_IDLE_TIMEOUT_MS"),
        connectionTimeoutMillis: parsePositiveInt(readOptionalEnv(env, "POSTGRES_CONNECTION_TIMEOUT_MS"), 5_000, "POSTGRES_CONNECTION_TIMEOUT_MS"),
        statement_timeout: parsePositiveInt(readOptionalEnv(env, "POSTGRES_STATEMENT_TIMEOUT_MS"), 15_000, "POSTGRES_STATEMENT_TIMEOUT_MS"),
        query_timeout: parsePositiveInt(readOptionalEnv(env, "POSTGRES_QUERY_TIMEOUT_MS"), 20_000, "POSTGRES_QUERY_TIMEOUT_MS"),
        application_name: readOptionalEnv(env, "POSTGRES_APPLICATION_NAME") ?? "interview-coach-provisioner",
    };

    if (databaseUrl) {
        return {
            connectionString: databaseUrl,
            ssl: getSslConfig(env, databaseUrl),
            ...shared,
        };
    }

    return {
        host: readRequiredEnv(env, "POSTGRES_HOST"),
        port: parsePositiveInt(readOptionalEnv(env, "POSTGRES_PORT"), 5432, "POSTGRES_PORT"),
        user: readRequiredEnv(env, "POSTGRES_USER"),
        password: readRequiredEnv(env, "POSTGRES_PASSWORD"),
        database: readRequiredEnv(env, "POSTGRES_DB"),
        ssl: getSslConfig(env),
        ...shared,
    };
}

function getSslConfig(env, databaseUrl) {
    const mode = (readOptionalEnv(env, "POSTGRES_SSL_MODE") ?? readOptionalEnv(env, "PGSSLMODE") ?? getUrlSslMode(databaseUrl))?.toLowerCase();
    const rejectUnauthorized = parseBoolean(readOptionalEnv(env, "POSTGRES_SSL_REJECT_UNAUTHORIZED"));

    if (mode === "disable") {
        return false;
    }

    if (mode) {
        if (!["allow", "prefer", "require", "verify-ca", "verify-full"].includes(mode)) {
            throw new Error(`Unsupported POSTGRES_SSL_MODE "${mode}".`);
        }

        return {
            rejectUnauthorized: rejectUnauthorized ?? (mode === "verify-ca" || mode === "verify-full"),
        };
    }

    return rejectUnauthorized === undefined ? undefined : { rejectUnauthorized };
}

function getUrlSslMode(databaseUrl) {
    if (!databaseUrl) return undefined;
    try {
        return new URL(databaseUrl).searchParams.get("sslmode") ?? undefined;
    } catch {
        return undefined;
    }
}

function readOptionalEnv(env, name) {
    const value = env[name];
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredEnv(env, name) {
    const value = readOptionalEnv(env, name);
    if (!value) {
        throw new Error(`Missing required environment variable ${name}. Provide DATABASE_URL or POSTGRES_* values.`);
    }

    return value;
}

function parsePositiveInt(value, fallback, name) {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer.`);
    }

    return parsed;
}

function parseBoolean(value) {
    if (!value) return undefined;
    if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
    if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
    throw new Error("POSTGRES_SSL_REJECT_UNAUTHORIZED must be true or false.");
}

function printUsage() {
    console.log(`
Provision an app-owned auth user in Postgres.

Usage:
  APP_USER_PASSWORD="use-a-long-temporary-password" npm run auth:provision-user -- --email fu@rangam.com --roles recruiter,admin,qa --first-name Fu --last-name Box --timezone America/Chicago

Options:
  --email <email>                  Required user email.
  --roles <roles>                  Comma-separated: recruiter,admin,qa. Default: recruiter.
  --password-env <name>            Env var containing the initial password. Default: APP_USER_PASSWORD.
  --password <password>            Initial password. Prefer env var so it is not stored in shell history.
  --first-name <name>              Optional profile first name.
  --last-name <name>               Optional profile last name.
  --display-name <name>            Optional display name.
  --title <title>                  Optional recruiter profile title.
  --phone <phone>                  Optional recruiter profile phone.
  --timezone <iana-zone>           Optional recruiter profile timezone. Default: UTC.
  --status <status>                active, invited, or disabled. Default: active.
  --no-verify-email                Leave email_verified_at unset.
  --allow-weak-password            Allow passwords shorter than ${MIN_PASSWORD_LENGTH} chars for disposable local users.
`);
}

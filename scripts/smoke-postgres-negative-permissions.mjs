#!/usr/bin/env node
import { randomBytes, scrypt } from "node:crypto";
import { Pool } from "pg";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const DEFAULT_ADMIN_EMAIL = "fu@rangam.com";
const DEFAULT_PASSWORD = "interviewcoach-local-user-password";
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

    const baseUrl = trimTrailingSlash(options.baseUrl || process.env.SMOKE_APP_BASE_URL || DEFAULT_BASE_URL);
    const adminEmail = options.email || process.env.SMOKE_RECRUITER_EMAIL || DEFAULT_ADMIN_EMAIL;
    const password = options.password || process.env.APP_USER_PASSWORD || DEFAULT_PASSWORD;
    const databaseUrl = options.smokeDefaults ? getSmokeDatabaseUrl() : (process.env.DATABASE_URL || getSmokeDatabaseUrl());
    const suffix = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const otherRecruiterEmail = `smoke.negative.recruiter+${suffix}@example.com`;
    const pool = new Pool({
        connectionString: databaseUrl,
        application_name: "interview-coach-negative-permissions-smoke",
        max: 2,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
    });

    try {
        console.log(`Running Postgres negative permissions smoke against ${baseUrl}`);

        const otherRecruiter = await provisionSmokeRecruiter(pool, {
            email: otherRecruiterEmail,
            password,
            suffix,
        });

        const adminLogin = await postJson(`${baseUrl}/api/auth/login`, { email: adminEmail, password });
        assertStatus(adminLogin, 200, "admin/recruiter login");
        const adminCookie = extractCookieHeader(adminLogin.response.headers);
        const adminUserId = adminLogin.body?.user?.id;
        if (!adminCookie || !adminUserId) {
            throw new Error(`Admin login did not return cookie and user id. Body: ${JSON.stringify(adminLogin.body)}`);
        }

        const otherLogin = await postJson(`${baseUrl}/api/auth/login`, { email: otherRecruiterEmail, password });
        assertStatus(otherLogin, 200, "second recruiter login");
        const otherCookie = extractCookieHeader(otherLogin.response.headers);
        if (!otherCookie) {
            throw new Error("Second recruiter login did not return an app session cookie.");
        }

        const invitePayload = buildInvitePayload(suffix);
        const createInvite = await postJson(`${baseUrl}/api/recruiter/invites`, invitePayload, {
            Cookie: adminCookie,
            "Idempotency-Key": `postgres-negative-create-${suffix}`,
        });
        assertStatus(createInvite, 200, "owner invite creation");

        const inviteResults = createInvite.body?.results ?? [];
        if (inviteResults.length !== 2 || !inviteResults[0]?.id || !inviteResults[1]?.id) {
            throw new Error(`Invite creation did not return two candidate sessions. Body: ${JSON.stringify(createInvite.body)}`);
        }

        const sessionA = inviteResults[0].id;
        const sessionB = inviteResults[1].id;
        const tokenA = extractCandidateToken(inviteResults[0].link, baseUrl);
        const tokenB = extractCandidateToken(inviteResults[1].link, baseUrl);

        const ownerCandidateFetch = await getJson(`${baseUrl}/api/session/${sessionA}`, {
            "x-candidate-token": tokenA,
        });
        assertStatus(ownerCandidateFetch, 200, "candidate session fetch with matching token");

        const missingCandidateToken = await getJson(`${baseUrl}/api/session/${sessionA}`);
        assertStatus(missingCandidateToken, 401, "candidate session fetch without token");

        const mismatchedCandidateToken = await getJson(`${baseUrl}/api/session/${sessionA}`, {
            "x-candidate-token": tokenB,
        });
        assertStatus(mismatchedCandidateToken, 403, "candidate session fetch with mismatched token");

        const crossRecruiterReview = await fetch(`${baseUrl}/recruiter/sessions/${sessionA}`, {
            headers: { Cookie: otherCookie },
            redirect: "manual",
        });
        if (crossRecruiterReview.status !== 404) {
            throw new Error(`Cross-recruiter session review returned ${crossRecruiterReview.status}; expected 404.`);
        }

        const crossRecruiterResend = await postJson(`${baseUrl}/api/invite/resend`, {
            sessionId: sessionA,
            recruiterName: "Smoke Negative",
            recruiterTitle: "Recruiter",
            recruiterCompany: "Rangam",
            recruiterEmail: otherRecruiterEmail,
        }, {
            Cookie: otherCookie,
        });
        assertStatus(crossRecruiterResend, 403, "cross-recruiter invite resend");

        const adminPageForRecruiter = await fetch(`${baseUrl}/admin/feedback`, {
            headers: { Cookie: otherCookie },
            redirect: "manual",
        });
        assertRedirect(adminPageForRecruiter, "/recruiter", "non-admin admin page access");

        const qaPageForRecruiter = await fetch(`${baseUrl}/qa/ai-quality`, {
            headers: { Cookie: otherCookie },
            redirect: "manual",
        });
        assertRedirect(qaPageForRecruiter, "/recruiter", "non-QA QA page access");

        const qaExportForRecruiter = await getJson(`${baseUrl}/qa/ai-quality/export?format=json&limit=1`, {
            Cookie: otherCookie,
        });
        assertStatus(qaExportForRecruiter, 403, "non-QA QA export access");

        const anonymousRecruiterPage = await fetch(`${baseUrl}/recruiter`, {
            redirect: "manual",
        });
        assertRedirect(anonymousRecruiterPage, "/login", "anonymous recruiter page access");

        const verified = await verifyDatabaseRows(pool, {
            sessionA,
            sessionB,
            ownerId: adminUserId,
            otherRecruiterId: otherRecruiter.userId,
        });

        console.log(JSON.stringify({
            ok: true,
            baseUrl,
            owner: {
                id: adminUserId,
                email: adminEmail,
            },
            otherRecruiter: {
                id: otherRecruiter.userId,
                email: otherRecruiterEmail,
            },
            permissions: {
                candidateMissingTokenStatus: missingCandidateToken.response.status,
                candidateMismatchStatus: mismatchedCandidateToken.response.status,
                crossRecruiterReviewStatus: crossRecruiterReview.status,
                crossRecruiterResendStatus: crossRecruiterResend.response.status,
                adminPageRedirect: adminPageForRecruiter.headers.get("location"),
                qaPageRedirect: qaPageForRecruiter.headers.get("location"),
                qaExportStatus: qaExportForRecruiter.response.status,
                anonymousRecruiterRedirect: anonymousRecruiterPage.headers.get("location"),
            },
            database: verified,
        }, null, 2));
    } finally {
        await pool.end();
    }
}

function buildInvitePayload(suffix) {
    return {
        role: "Warehouse Associate",
        jobDescription: "Support a busy warehouse team by picking, packing, documenting inventory movement, following safety procedures, and communicating clearly when priorities change.",
        candidates: [
            {
                firstName: "Smoke",
                lastName: "Owner",
                email: `smoke.negative.owner+${suffix}@example.com`,
                reqId: `SMOKE-NEG-A-${suffix}`,
                resumeText: "Warehouse associate with inventory, packing, and safety experience.",
            },
            {
                firstName: "Smoke",
                lastName: "Mismatch",
                email: `smoke.negative.mismatch+${suffix}@example.com`,
                reqId: `SMOKE-NEG-B-${suffix}`,
                resumeText: "Warehouse associate with shift handoff and quality-control experience.",
            },
        ],
        questions: [
            {
                text: "What steps would you take if a scanner count did not match the physical items in front of you?",
                category: "Technical",
                index: 0,
            },
        ],
    };
}

async function provisionSmokeRecruiter(pool, params) {
    const passwordHash = await hashPassword(params.password);
    const displayName = `Smoke Negative ${params.suffix}`;
    const client = await pool.connect();
    try {
        await client.query("begin");

        const user = await client.query(
            `
                insert into public.app_users (
                    email,
                    display_name,
                    first_name,
                    last_name,
                    status,
                    email_verified_at
                )
                values ($1, $2, 'Smoke', 'Negative', 'active', now())
                returning user_id, email
            `,
            [params.email.toLowerCase(), displayName]
        );
        const userId = user.rows[0].user_id;

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

        await client.query("delete from public.app_user_roles where user_id = $1 and role <> 'recruiter'", [userId]);
        await client.query(
            `
                insert into public.app_user_roles (user_id, role)
                values ($1, 'recruiter')
                on conflict (user_id, role) do nothing
            `,
            [userId]
        );

        await client.query(
            `
                insert into public.recruiter_profiles (
                    recruiter_id,
                    first_name,
                    last_name,
                    title,
                    timezone
                )
                values ($1, 'Smoke', 'Negative', 'Recruiter', 'America/Chicago')
                on conflict (recruiter_id)
                do update set
                    first_name = excluded.first_name,
                    last_name = excluded.last_name,
                    title = excluded.title,
                    timezone = excluded.timezone
            `,
            [userId]
        );

        await client.query("commit");
        return {
            userId,
            email: user.rows[0].email,
        };
    } catch (error) {
        await client.query("rollback");
        throw error;
    } finally {
        client.release();
    }
}

async function verifyDatabaseRows(pool, expected) {
    const [sessions, otherRoles] = await Promise.all([
        pool.query(
            `
                select session_id, recruiter_id
                from public.sessions
                where session_id = any($1::uuid[])
                order by session_id
            `,
            [[expected.sessionA, expected.sessionB]]
        ),
        pool.query(
            `
                select array_agg(role order by role) as roles
                from public.app_user_roles
                where user_id = $1
            `,
            [expected.otherRecruiterId]
        ),
    ]);

    if (sessions.rows.length !== 2) {
        throw new Error(`Expected two smoke session rows, found ${sessions.rows.length}.`);
    }

    for (const row of sessions.rows) {
        if (row.recruiter_id !== expected.ownerId) {
            throw new Error(`Session ${row.session_id} recruiter_id was ${row.recruiter_id}; expected owner ${expected.ownerId}.`);
        }
    }

    const roles = otherRoles.rows[0]?.roles ?? [];
    if (roles.length !== 1 || roles[0] !== "recruiter") {
        throw new Error(`Second smoke user roles were ${JSON.stringify(roles)}; expected only recruiter.`);
    }

    return {
        ownerSessionRows: sessions.rows.length,
        otherRecruiterRoles: roles,
    };
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

function parseArgs(args) {
    const options = {};

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--help" || arg === "-h") {
            options.help = true;
            continue;
        }

        if (arg === "--smoke-defaults") {
            options.smokeDefaults = true;
            continue;
        }

        if (arg === "--base-url") {
            options.baseUrl = args[++index];
            if (!options.baseUrl) throw new Error("Missing value for --base-url.");
            continue;
        }

        if (arg.startsWith("--base-url=")) {
            options.baseUrl = arg.slice("--base-url=".length);
            continue;
        }

        if (arg === "--email") {
            options.email = args[++index];
            if (!options.email) throw new Error("Missing value for --email.");
            continue;
        }

        if (arg === "--password") {
            options.password = args[++index];
            if (!options.password) throw new Error("Missing value for --password.");
            continue;
        }

        throw new Error(`Unknown option "${arg}".`);
    }

    return options;
}

async function getJson(url, headers = {}) {
    return readJsonResponse(await fetch(url, { method: "GET", headers }));
}

async function postJson(url, body, headers = {}) {
    return readJsonResponse(await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
    }));
}

async function readJsonResponse(response) {
    const text = await response.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }

    return { response, body };
}

function assertStatus(result, expectedStatus, label) {
    if (result.response.status !== expectedStatus) {
        throw new Error(`${label} returned ${result.response.status}; expected ${expectedStatus}. Body: ${JSON.stringify(result.body)}`);
    }
}

function assertRedirect(response, expectedPath, label) {
    if (![303, 307, 308].includes(response.status)) {
        throw new Error(`${label} returned ${response.status}; expected redirect to ${expectedPath}.`);
    }

    const location = response.headers.get("location");
    if (!location) {
        throw new Error(`${label} did not include a redirect location.`);
    }

    const redirectedPath = new URL(location, DEFAULT_BASE_URL).pathname;
    if (redirectedPath !== expectedPath) {
        throw new Error(`${label} redirected to ${location}; expected ${expectedPath}.`);
    }
}

function extractCandidateToken(link, baseUrl) {
    const token = new URL(link, `${baseUrl}/`).pathname.split("/").filter(Boolean).at(-1);
    if (!token) {
        throw new Error(`Could not extract candidate token from invite link: ${link}`);
    }
    return token;
}

function extractCookieHeader(headers) {
    const setCookie = headers.getSetCookie ? headers.getSetCookie() : [];
    return setCookie.map((cookie) => cookie.split(";")[0]).join("; ");
}

function trimTrailingSlash(value) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
}

function printUsage() {
    console.log(`
Usage: node scripts/smoke-postgres-negative-permissions.mjs [options]

Options:
  --smoke-defaults       Use the disposable Postgres smoke database URL.
  --base-url <url>       App base URL. Defaults to ${DEFAULT_BASE_URL}.
  --email <email>        Admin/recruiter login email. Defaults to ${DEFAULT_ADMIN_EMAIL}.
  --password <password>  Login password. Defaults to APP_USER_PASSWORD or local smoke default.
`);
}

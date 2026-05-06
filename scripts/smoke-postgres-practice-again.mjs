#!/usr/bin/env node
import { Pool } from "pg";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const DEFAULT_EMAIL = "fu@rangam.com";
const DEFAULT_PASSWORD = "interviewcoach-local-user-password";

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
    const email = options.email || process.env.SMOKE_RECRUITER_EMAIL || DEFAULT_EMAIL;
    const password = options.password || process.env.APP_USER_PASSWORD || DEFAULT_PASSWORD;
    const databaseUrl = options.smokeDefaults ? getSmokeDatabaseUrl() : (process.env.DATABASE_URL || getSmokeDatabaseUrl());
    const suffix = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const pool = new Pool({
        connectionString: databaseUrl,
        application_name: "interview-coach-practice-again-smoke",
        max: 2,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
    });

    try {
        console.log(`Running Postgres practice-again smoke against ${baseUrl}`);

        const login = await postJson(`${baseUrl}/api/auth/login`, { email, password });
        assertStatus(login, 200, "recruiter login");
        const cookieHeader = extractCookieHeader(login.response.headers);
        if (!cookieHeader) {
            throw new Error("Login did not return an app session cookie.");
        }

        const invitePayload = buildInvitePayload(suffix);
        const createInvite = await postJson(`${baseUrl}/api/recruiter/invites`, invitePayload, {
            Cookie: cookieHeader,
            "Idempotency-Key": `postgres-practice-again-create-${suffix}`,
        });
        assertStatus(createInvite, 200, "invite creation");

        const result = createInvite.body?.results?.[0];
        if (!result?.id || !result?.link) {
            throw new Error(`Invite creation did not return a candidate link. Body: ${JSON.stringify(createInvite.body)}`);
        }

        const attempt1Token = new URL(result.link).pathname.split("/").filter(Boolean).at(-1);
        if (!attempt1Token) {
            throw new Error(`Could not extract candidate token from invite link: ${result.link}`);
        }

        const attempt2 = await startRepeatAttempt(baseUrl, {
            parentSessionId: result.id,
            parentToken: attempt1Token,
            role: invitePayload.role,
            label: "attempt 2 start",
        });

        const attempt2Fetch = await getJson(`${baseUrl}/api/session/${attempt2.session.id}`, {
            "x-candidate-token": attempt2.token,
        });
        assertStatus(attempt2Fetch, 200, "attempt 2 fetch");
        assertSession(attempt2Fetch.body, {
            parentSessionId: result.id,
            attemptNumber: 2,
            inviteToken: attempt2.token,
            label: "attempt 2",
        });

        const attempt3 = await startRepeatAttempt(baseUrl, {
            parentSessionId: attempt2.session.id,
            parentToken: attempt2.token,
            role: invitePayload.role,
            label: "attempt 3 start",
        });

        const attempt3Fetch = await getJson(`${baseUrl}/api/session/${attempt3.session.id}`, {
            "x-candidate-token": attempt3.token,
        });
        assertStatus(attempt3Fetch, 200, "attempt 3 fetch");
        assertSession(attempt3Fetch.body, {
            parentSessionId: attempt2.session.id,
            attemptNumber: 3,
            inviteToken: attempt3.token,
            label: "attempt 3",
        });

        const verified = await verifyDatabaseRows(pool, {
            attempt1Id: result.id,
            attempt2Id: attempt2.session.id,
            attempt3Id: attempt3.session.id,
        });

        console.log(JSON.stringify({
            ok: true,
            baseUrl,
            invite: {
                batchId: createInvite.body.batchId,
                attempt1SessionId: result.id,
            },
            practiceAgain: {
                attempt2SessionId: attempt2.session.id,
                attempt3SessionId: attempt3.session.id,
            },
            database: verified,
        }, null, 2));
    } finally {
        await pool.end();
    }
}

async function startRepeatAttempt(baseUrl, params) {
    const result = await postJson(`${baseUrl}/api/session/start`, {
        role: params.role,
        parentId: params.parentSessionId,
    }, {
        "x-candidate-token": params.parentToken,
        "Idempotency-Key": `postgres-practice-again-${params.label.replaceAll(" ", "-")}-${Date.now()}`,
    });
    assertStatus(result, 200, params.label);

    const token = result.response.headers.get("x-candidate-token");
    if (!token) {
        throw new Error(`${params.label} did not return x-candidate-token.`);
    }

    if (token === params.parentToken) {
        throw new Error(`${params.label} reused the parent token.`);
    }

    if (!result.body?.id) {
        throw new Error(`${params.label} did not return a session id. Body: ${JSON.stringify(result.body)}`);
    }

    return {
        session: result.body,
        token,
    };
}

function assertSession(session, expected) {
    if (session.parentSessionId !== expected.parentSessionId) {
        throw new Error(`${expected.label} parentSessionId was ${session.parentSessionId}; expected ${expected.parentSessionId}.`);
    }

    if (session.attemptNumber !== expected.attemptNumber) {
        throw new Error(`${expected.label} attemptNumber was ${session.attemptNumber}; expected ${expected.attemptNumber}.`);
    }

    if (session.inviteToken !== expected.inviteToken) {
        throw new Error(`${expected.label} inviteToken did not match the issued token.`);
    }
}

async function verifyDatabaseRows(pool, expected) {
    const [sessions, tokens] = await Promise.all([
        pool.query(
            `
                select
                    session_id,
                    parent_session_id,
                    attempt_number,
                    intake_json ? 'invite_token' as has_invite_token
                from public.sessions
                where session_id = any($1::uuid[])
                order by attempt_number nulls first
            `,
            [[expected.attempt1Id, expected.attempt2Id, expected.attempt3Id]]
        ),
        pool.query(
            `
                select session_id, count(*)::int as token_count
                from public.candidate_tokens
                where session_id = any($1::uuid[])
                  and revoked_at is null
                group by session_id
            `,
            [[expected.attempt1Id, expected.attempt2Id, expected.attempt3Id]]
        ),
    ]);

    const byId = new Map(sessions.rows.map((row) => [row.session_id, row]));
    const tokenCounts = new Map(tokens.rows.map((row) => [row.session_id, Number(row.token_count)]));
    const attempt2 = byId.get(expected.attempt2Id);
    const attempt3 = byId.get(expected.attempt3Id);

    assertRow(attempt2, "attempt 2 session row");
    assertRow(attempt3, "attempt 3 session row");

    if (attempt2.parent_session_id !== expected.attempt1Id || Number(attempt2.attempt_number) !== 2 || !attempt2.has_invite_token) {
        throw new Error(`Attempt 2 DB lineage/token metadata is incorrect: ${JSON.stringify(attempt2)}`);
    }

    if (attempt3.parent_session_id !== expected.attempt2Id || Number(attempt3.attempt_number) !== 3 || !attempt3.has_invite_token) {
        throw new Error(`Attempt 3 DB lineage/token metadata is incorrect: ${JSON.stringify(attempt3)}`);
    }

    for (const sessionId of [expected.attempt1Id, expected.attempt2Id, expected.attempt3Id]) {
        if (tokenCounts.get(sessionId) !== 1) {
            throw new Error(`Active candidate token count for ${sessionId} was ${tokenCounts.get(sessionId) || 0}; expected 1.`);
        }
    }

    return {
        attemptRows: sessions.rows.length,
        activeCandidateTokenRows: tokens.rows.reduce((total, row) => total + Number(row.token_count), 0),
        attempt2HasInviteToken: attempt2.has_invite_token,
        attempt3HasInviteToken: attempt3.has_invite_token,
    };
}

function buildInvitePayload(suffix) {
    return {
        role: "Warehouse Associate",
        jobDescription: "Support a busy warehouse team by picking, packing, documenting inventory movement, following safety procedures, and communicating clearly when priorities change.",
        candidates: [
            {
                firstName: "Smoke",
                lastName: "Repeater",
                email: `smoke.repeater+${suffix}@example.com`,
                reqId: `SMOKE-REPEAT-${suffix}`,
                resumeText: "Warehouse associate with experience in inventory checks, packing accuracy, safety procedures, and shift handoffs.",
            },
        ],
        questions: [
            {
                text: "Tell me about a time you caught an inventory or packing mistake before it reached a customer.",
                category: "Behavioral",
                index: 0,
            },
            {
                text: "How do you stay accurate when the warehouse is busy and priorities keep changing?",
                category: "Culture",
                index: 1,
            },
        ],
    };
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

function assertRow(row, label) {
    if (!row) {
        throw new Error(`Missing ${label}.`);
    }
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
Usage: node scripts/smoke-postgres-practice-again.mjs [options]

Options:
  --smoke-defaults       Use the disposable Postgres smoke database URL.
  --base-url <url>       App base URL. Defaults to ${DEFAULT_BASE_URL}.
  --email <email>        Recruiter login email. Defaults to ${DEFAULT_EMAIL}.
  --password <password>  Recruiter login password. Defaults to APP_USER_PASSWORD or local smoke default.
`);
}

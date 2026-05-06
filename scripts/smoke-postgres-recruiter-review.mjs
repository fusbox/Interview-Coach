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
        application_name: "interview-coach-recruiter-review-smoke",
        max: 2,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
    });

    try {
        console.log(`Running Postgres recruiter review smoke against ${baseUrl}`);

        const login = await postJson(`${baseUrl}/api/auth/login`, { email, password });
        assertStatus(login, 200, "recruiter login");
        const cookieHeader = extractCookieHeader(login.response.headers);
        if (!cookieHeader) {
            throw new Error("Login did not return an app session cookie.");
        }
        const userId = login.body?.user?.id;
        if (!userId) {
            throw new Error(`Login response did not include user id. Body: ${JSON.stringify(login.body)}`);
        }

        const invitePayload = buildInvitePayload(suffix);
        const createInvite = await postJson(`${baseUrl}/api/recruiter/invites`, invitePayload, {
            Cookie: cookieHeader,
            "Idempotency-Key": `postgres-review-create-${suffix}`,
        });
        assertStatus(createInvite, 200, "invite creation");

        const inviteResult = createInvite.body?.results?.[0];
        if (!inviteResult?.id || !inviteResult?.link) {
            throw new Error(`Invite creation did not return a candidate link. Body: ${JSON.stringify(createInvite.body)}`);
        }

        const candidateToken = new URL(inviteResult.link, `${baseUrl}/`).pathname.split("/").filter(Boolean).at(-1);
        if (!candidateToken) {
            throw new Error(`Could not extract candidate token from invite link: ${inviteResult.link}`);
        }

        const session = await getJson(`${baseUrl}/api/session/${inviteResult.id}`, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(session, 200, "candidate session fetch");

        if (session.body?.initialsRequired) {
            const initials = await patchJson(`${baseUrl}/api/session/${inviteResult.id}`, {
                enteredInitials: "RR",
                initialsRequired: false,
            }, {
                "x-candidate-token": candidateToken,
            });
            assertStatus(initials, 200, "candidate initials submission");
        }

        const start = await patchJson(`${baseUrl}/api/session/${inviteResult.id}`, {
            status: "IN_SESSION",
        }, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(start, 200, "candidate session start");

        const firstQuestion = session.body?.questions?.[0];
        if (!firstQuestion?.id) {
            throw new Error("Candidate session did not include a first question.");
        }

        const answerText = "I would compare the pick ticket to the physical inventory, pause the shipment, notify the lead, correct the count, and document the handoff so the next shift knows what changed.";
        const submit = await postJson(`${baseUrl}/api/session/${inviteResult.id}/questions/${firstQuestion.id}/submit`, {
            text: answerText,
            modality: "text",
        }, {
            "x-candidate-token": candidateToken,
            "Idempotency-Key": `postgres-review-submit-${suffix}`,
        });
        assertStatus(submit, 200, "candidate answer submit");

        const reviewPage = await fetch(`${baseUrl}/recruiter/sessions/${inviteResult.id}`, {
            headers: {
                Cookie: cookieHeader,
            },
        });
        const reviewHtml = await reviewPage.text();
        if (reviewPage.status !== 200) {
            throw new Error(`Recruiter review page returned ${reviewPage.status}; expected 200. Body: ${reviewHtml.slice(0, 500)}`);
        }

        assertIncludes(reviewHtml, "Session Details", "review page title");
        assertIncludes(reviewHtml, "Smoke Review", "candidate name");
        assertIncludes(reviewHtml, invitePayload.role, "target role");
        assertIncludes(reviewHtml, firstQuestion.text, "question text");
        assertIncludes(reviewHtml, "Candidate Response", "candidate response heading");
        assertIncludes(reviewHtml, "I would compare the pick ticket", "candidate transcript");
        if (reviewHtml.includes("Content Pulse") || reviewHtml.includes("Delivery Pulse")) {
            throw new Error("Recruiter review page exposed candidate AI feedback, which is not part of the recruiter UI contract.");
        }

        const verified = await verifyDatabaseRows(pool, {
            sessionId: inviteResult.id,
            recruiterId: userId,
        });

        console.log(JSON.stringify({
            ok: true,
            baseUrl,
            user: {
                id: userId,
                email,
            },
            review: {
                sessionId: inviteResult.id,
                pageStatus: reviewPage.status,
                candidateName: "Smoke Review",
                role: invitePayload.role,
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
                lastName: "Review",
                email: `smoke.review+${suffix}@example.com`,
                reqId: `SMOKE-REVIEW-${suffix}`,
                resumeText: "Warehouse associate with experience in inventory checks, packing accuracy, safety procedures, and shift handoffs.",
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

async function verifyDatabaseRows(pool, expected) {
    const [session, answers] = await Promise.all([
        pool.query(
            "select recruiter_id, target_role, status, intake_json from public.sessions where session_id = $1",
            [expected.sessionId]
        ),
        pool.query(
            "select count(*)::int as count, count(*) filter (where final_text is not null)::int as final_count from public.answers where session_id = $1",
            [expected.sessionId]
        ),
    ]);

    const sessionRow = session.rows[0];
    if (!sessionRow) {
        throw new Error(`Missing session row for ${expected.sessionId}.`);
    }

    if (sessionRow.recruiter_id !== expected.recruiterId) {
        throw new Error(`Session recruiter_id was ${sessionRow.recruiter_id}; expected ${expected.recruiterId}.`);
    }

    assertCount(answers.rows[0]?.count, 1, "answer rows");
    assertCount(answers.rows[0]?.final_count, 1, "final answer rows");

    return {
        sessionStatus: sessionRow.status,
        targetRole: sessionRow.target_role,
        answerRows: answers.rows[0].count,
        finalAnswerRows: answers.rows[0].final_count,
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

async function patchJson(url, body, headers = {}) {
    return readJsonResponse(await fetch(url, {
        method: "PATCH",
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

function assertIncludes(text, expected, label) {
    if (!text.includes(expected)) {
        throw new Error(`Review page did not include ${label}: ${expected}`);
    }
}

function assertCount(actual, expected, label) {
    if (Number(actual) !== expected) {
        throw new Error(`${label} count was ${actual}; expected ${expected}.`);
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
Usage: node scripts/smoke-postgres-recruiter-review.mjs [options]

Options:
  --smoke-defaults       Use the disposable Postgres smoke database URL.
  --base-url <url>       App base URL. Defaults to ${DEFAULT_BASE_URL}.
  --email <email>        Recruiter login email. Defaults to ${DEFAULT_EMAIL}.
  --password <password>  Recruiter login password. Defaults to APP_USER_PASSWORD or local smoke default.
`);
}

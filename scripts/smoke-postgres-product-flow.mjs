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
        application_name: "interview-coach-product-smoke",
        max: 2,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
    });

    try {
        console.log(`Running Postgres product smoke against ${baseUrl}`);

        const login = await postJson(`${baseUrl}/api/auth/login`, {
            email,
            password,
        });
        assertStatus(login, 200, "recruiter login");
        const cookieHeader = extractCookieHeader(login.response.headers);
        if (!cookieHeader) {
            throw new Error("Login did not return an app session cookie.");
        }
        const userId = login.body?.user?.id;
        if (!userId) {
            throw new Error("Login response did not include a user id.");
        }

        const invitePayload = buildInvitePayload(suffix);
        const createInvite = await postJson(`${baseUrl}/api/recruiter/invites`, invitePayload, {
            Cookie: cookieHeader,
            "Idempotency-Key": `postgres-product-smoke-create-${suffix}`,
        });
        assertStatus(createInvite, 200, "invite creation");

        const result = createInvite.body?.results?.[0];
        if (!result?.id || !result?.link) {
            throw new Error(`Invite creation did not return a candidate link. Body: ${JSON.stringify(createInvite.body)}`);
        }

        const candidateUrl = new URL(result.link);
        const candidateToken = candidateUrl.pathname.split("/").filter(Boolean).at(-1);
        if (!candidateToken) {
            throw new Error(`Could not extract candidate token from invite link: ${result.link}`);
        }

        const candidatePage = await fetch(`${baseUrl}/s/${candidateToken}`);
        assertStatus({ response: candidatePage }, 200, "candidate invite page");

        const session = await getJson(`${baseUrl}/api/session/${result.id}`, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(session, 200, "candidate session fetch");

        const firstQuestion = session.body?.questions?.[0];
        if (!firstQuestion?.id) {
            throw new Error("Candidate session did not include a first question.");
        }

        if (session.body.initialsRequired) {
            const initials = await patchJson(`${baseUrl}/api/session/${result.id}`, {
                enteredInitials: "SC",
                initialsRequired: false,
            }, {
                "x-candidate-token": candidateToken,
            });
            assertStatus(initials, 200, "candidate initials submission");
        }

        const start = await patchJson(`${baseUrl}/api/session/${result.id}`, {
            status: "IN_SESSION",
        }, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(start, 200, "candidate session start");

        const draft = await putJson(`${baseUrl}/api/session/${result.id}/questions/${firstQuestion.id}/answer`, {
            text: "I would clarify the priority, document the tradeoffs, and communicate the plan before moving forward.",
            isFinal: false,
        }, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(draft, 200, "candidate draft save");

        const answerText = "In a previous role, I had to balance a late-breaking operational request with a customer commitment. I clarified the impact, aligned the team on the highest-risk work, communicated the tradeoff, and followed up with a written handoff so nothing was lost.";
        const submit = await postJson(`${baseUrl}/api/session/${result.id}/questions/${firstQuestion.id}/submit`, {
            text: answerText,
            modality: "text",
        }, {
            "x-candidate-token": candidateToken,
            "Idempotency-Key": `postgres-product-smoke-submit-${suffix}`,
        });
        assertStatus(submit, 200, "candidate answer submit");

        const analysis = await postJson(`${baseUrl}/api/session/${result.id}/questions/${firstQuestion.id}/analysis`, {}, {
            "x-candidate-token": candidateToken,
            "Idempotency-Key": `postgres-product-smoke-analysis-${suffix}`,
        });
        assertStatus(analysis, 200, "candidate answer analysis");

        const verified = await verifyDatabaseRows(pool, {
            batchId: createInvite.body.batchId,
            sessionId: result.id,
            questionId: firstQuestion.id,
            candidateEmail: invitePayload.candidates[0].email,
        });

        console.log(JSON.stringify({
            ok: true,
            baseUrl,
            recruiter: {
                email,
                userId,
            },
            invite: {
                batchId: createInvite.body.batchId,
                sessionId: result.id,
                link: result.link,
            },
            candidate: {
                firstQuestionId: firstQuestion.id,
                finalStatus: analysis.body.status,
            },
            database: verified,
        }, null, 2));
    } finally {
        await pool.end();
    }
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

        if (arg.startsWith("--email=")) {
            options.email = arg.slice("--email=".length);
            continue;
        }

        if (arg === "--password") {
            options.password = args[++index];
            if (!options.password) throw new Error("Missing value for --password.");
            continue;
        }

        if (arg.startsWith("--password=")) {
            options.password = arg.slice("--password=".length);
            continue;
        }

        throw new Error(`Unknown option "${arg}".`);
    }

    return options;
}

function buildInvitePayload(suffix) {
    return {
        role: "Warehouse Associate",
        jobDescription: "Support a busy warehouse team by picking, packing, documenting inventory movement, following safety procedures, and communicating clearly when priorities change.",
        candidates: [
            {
                firstName: "Smoke",
                lastName: "Candidate",
                email: `smoke.candidate+${suffix}@example.com`,
                reqId: `SMOKE-WH-${suffix}`,
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
            {
                text: "What steps would you take if a scanner count did not match the physical items in front of you?",
                category: "Technical",
                index: 2,
            },
        ],
    };
}

async function verifyDatabaseRows(pool, expected) {
    const [
        batch,
        candidate,
        session,
        questions,
        answers,
        evals,
        tokens,
        idempotency,
        rateLimits,
        metrics,
        aiGenerations,
    ] = await Promise.all([
        pool.query("select status, requested_count, succeeded_count, failed_count from public.invite_batches where batch_id = $1", [expected.batchId]),
        pool.query("select status, session_id from public.invite_batch_candidates where batch_id = $1 and email = $2", [expected.batchId, expected.candidateEmail]),
        pool.query("select status, target_role, intake_json from public.sessions where session_id = $1", [expected.sessionId]),
        pool.query("select count(*)::int as count from public.questions where session_id = $1", [expected.sessionId]),
        pool.query("select count(*)::int as count, count(*) filter (where final_text is not null)::int as final_count from public.answers where session_id = $1", [expected.sessionId]),
        pool.query("select count(*)::int as count from public.eval_results where session_id = $1 and question_id = $2", [expected.sessionId, expected.questionId]),
        pool.query("select count(*)::int as count from public.candidate_tokens where session_id = $1 and revoked_at is null", [expected.sessionId]),
        pool.query("select count(*)::int as count from public.api_idempotency_keys where actor_id = $1", [expected.sessionId]),
        pool.query("select count(*)::int as count from public.rate_limit_buckets"),
        pool.query("select count(*)::int as counter_count from public.metric_counter_rollups"),
        pool.query("select count(*)::int as count from public.ai_generations where session_id = $1", [expected.sessionId]),
    ]);

    assertRow(batch.rows[0], "invite batch row");
    assertRow(candidate.rows[0], "invite batch candidate row");
    assertRow(session.rows[0], "session row");
    assertCount(questions.rows[0]?.count, 3, "question rows");
    assertCount(answers.rows[0]?.count, 1, "answer rows");
    assertCount(answers.rows[0]?.final_count, 1, "final answer rows");
    assertCount(evals.rows[0]?.count, 1, "eval result rows");
    assertCount(tokens.rows[0]?.count, 1, "candidate token rows");
    assertMinimum(idempotency.rows[0]?.count, 2, "idempotency rows");
    assertMinimum(rateLimits.rows[0]?.count, 1, "rate limit rows");
    assertMinimum(metrics.rows[0]?.counter_count, 1, "metric counter rows");
    assertMinimum(aiGenerations.rows[0]?.count, 1, "AI generation rows");

    return {
        inviteBatchStatus: batch.rows[0].status,
        inviteBatchCandidateStatus: candidate.rows[0].status,
        sessionStatus: session.rows[0].status,
        questionRows: questions.rows[0].count,
        answerRows: answers.rows[0].count,
        evalRows: evals.rows[0].count,
        candidateTokenRows: tokens.rows[0].count,
        idempotencyRowsForSession: idempotency.rows[0].count,
        rateLimitRows: rateLimits.rows[0].count,
        metricCounterRows: metrics.rows[0].counter_count,
        aiGenerationRowsForSession: aiGenerations.rows[0].count,
    };
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

async function putJson(url, body, headers = {}) {
    return readJsonResponse(await fetch(url, {
        method: "PUT",
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

function assertCount(actual, expected, label) {
    if (Number(actual) !== expected) {
        throw new Error(`${label} count was ${actual}; expected ${expected}.`);
    }
}

function assertMinimum(actual, minimum, label) {
    if (Number(actual) < minimum) {
        throw new Error(`${label} count was ${actual}; expected at least ${minimum}.`);
    }
}

function extractCookieHeader(headers) {
    const getSetCookie = typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : [];
    const cookieHeaders = getSetCookie.length > 0
        ? getSetCookie
        : [headers.get("set-cookie")].filter(Boolean);

    return cookieHeaders
        .map((value) => value.split(";")[0])
        .filter(Boolean)
        .join("; ");
}

function trimTrailingSlash(value) {
    return value.replace(/\/+$/, "");
}

function printUsage() {
    console.log(`
Usage:
  npm run postgres:smoke:product
  node scripts/smoke-postgres-product-flow.mjs --base-url http://127.0.0.1:3100 --smoke-defaults

Defaults:
  base URL: ${DEFAULT_BASE_URL}
  recruiter email: ${DEFAULT_EMAIL}
  password: APP_USER_PASSWORD or ${DEFAULT_PASSWORD}

Notes:
  Start the app separately with the Postgres smoke env values before running this script.
  This smoke covers invite generation and candidate practice data flow. It does not send email.
`);
}

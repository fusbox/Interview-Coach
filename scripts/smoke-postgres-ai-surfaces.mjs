#!/usr/bin/env node
import { Pool } from "pg";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const DEFAULT_EMAIL = "fu@rangam.com";
const DEFAULT_PASSWORD = "interviewcoach-local-user-password";
const EXPECTED_PROVIDER = "gemini";
const EXPECTED_MODEL = "gemini-2.5-flash";
const EXPECTED_SURFACES = [
    "question_generation",
    "hint",
    "strong_response",
    "answer_feedback",
    "session_debrief",
];

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
    const runStartedAt = new Date();
    const suffix = runStartedAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const pool = new Pool({
        connectionString: databaseUrl,
        application_name: "interview-coach-ai-surface-smoke",
        max: 2,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
    });

    try {
        console.log(`Running Postgres AI-surface smoke against ${baseUrl}`);

        const login = await postJson(`${baseUrl}/api/auth/login`, { email, password });
        assertStatus(login, 200, "recruiter login");
        const cookieHeader = extractCookieHeader(login.response.headers);
        if (!cookieHeader) {
            throw new Error("Login did not return an app session cookie.");
        }
        const userId = login.body?.user?.id;
        if (!userId) {
            throw new Error("Login response did not include a user id.");
        }

        const jobDescription = "Support a busy warehouse team by picking, packing, documenting inventory movement, following safety procedures, and communicating clearly when priorities change.";
        const resumeText = "Warehouse associate with experience in inventory checks, packing accuracy, safety procedures, and shift handoffs.";
        const generatedQuestions = await postJson(`${baseUrl}/api/questions/generate`, {
            role: "Warehouse Associate",
            jobDescription,
            resume: resumeText,
        }, {
            Cookie: cookieHeader,
        });
        assertStatus(generatedQuestions, 200, "question generation");

        const invitePayload = buildInvitePayload(suffix, jobDescription, resumeText, flattenGeneratedQuestions(generatedQuestions.body));
        const createInvite = await postJson(`${baseUrl}/api/recruiter/invites`, invitePayload, {
            Cookie: cookieHeader,
            "Idempotency-Key": `postgres-ai-smoke-create-${suffix}`,
        });
        assertStatus(createInvite, 200, "invite creation");

        const inviteResult = createInvite.body?.results?.[0];
        if (!inviteResult?.id || !inviteResult?.link) {
            throw new Error(`Invite creation did not return a candidate link. Body: ${JSON.stringify(createInvite.body)}`);
        }

        const candidateUrl = new URL(inviteResult.link);
        const candidateToken = candidateUrl.pathname.split("/").filter(Boolean).at(-1);
        if (!candidateToken) {
            throw new Error(`Could not extract candidate token from invite link: ${inviteResult.link}`);
        }

        const candidatePage = await fetch(`${baseUrl}/s/${candidateToken}`);
        assertStatus({ response: candidatePage }, 200, "candidate invite page");

        let session = await getJson(`${baseUrl}/api/session/${inviteResult.id}`, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(session, 200, "candidate session fetch");

        const firstQuestion = session.body?.questions?.[0];
        if (!firstQuestion?.id) {
            throw new Error("Candidate session did not include a first question.");
        }

        const tips = await postJson(`${baseUrl}/api/tips/generate`, {
            sessionId: inviteResult.id,
            question: firstQuestion.text,
            role: session.body.role,
            resumeText,
        }, {
            "x-candidate-token": candidateToken,
            "Idempotency-Key": `postgres-ai-smoke-hint-${suffix}`,
        });
        assertStatus(tips, 200, "hint generation");

        const strongResponse = await postJson(`${baseUrl}/api/response/generate`, {
            sessionId: inviteResult.id,
            question: firstQuestion.text,
            role: session.body.role,
            resumeText,
        }, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(strongResponse, 200, "strong response generation");

        if (session.body.initialsRequired) {
            const initials = await patchJson(`${baseUrl}/api/session/${inviteResult.id}`, {
                enteredInitials: "SC",
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

        const answerText = "In a previous warehouse role, I found a mismatch between the scanner count and the items staged for packing. I stopped the pack, checked the pick ticket against the shelf location, asked a lead to verify the exception, corrected the count, and documented the issue so the next shift could watch for the same bin problem.";
        const submit = await postJson(`${baseUrl}/api/session/${inviteResult.id}/questions/${firstQuestion.id}/submit`, {
            text: answerText,
            modality: "text",
        }, {
            "x-candidate-token": candidateToken,
            "Idempotency-Key": `postgres-ai-smoke-submit-${suffix}`,
        });
        assertStatus(submit, 200, "candidate answer submit");

        const analysis = await postJson(`${baseUrl}/api/session/${inviteResult.id}/questions/${firstQuestion.id}/analysis`, {}, {
            "x-candidate-token": candidateToken,
            "Idempotency-Key": `postgres-ai-smoke-analysis-${suffix}`,
        });
        assertStatus(analysis, 200, "answer feedback generation");

        const completion = await patchJson(`${baseUrl}/api/session/${inviteResult.id}`, {
            currentQuestionIndex: session.body.questions.length,
            status: "COMPLETED",
        }, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(completion, 200, "session completion and debrief generation");
        if (!completion.body?.summaryNarrative) {
            throw new Error("Session completion did not return a summary narrative.");
        }

        const qaPage = await fetch(`${baseUrl}/qa/ai-quality?status=success&limit=25`, {
            headers: { Cookie: cookieHeader },
        });
        assertStatus({ response: qaPage }, 200, "QA AI-quality page");

        const qaExport = await getJson(`${baseUrl}/qa/ai-quality/export?format=json&status=success&limit=100`, {
            Cookie: cookieHeader,
        });
        assertStatus(qaExport, 200, "QA AI-quality export");
        if (!Array.isArray(qaExport.body?.records)) {
            throw new Error("QA AI-quality export did not return a records array.");
        }

        const verified = await verifyAiGenerationRows(pool, {
            since: runStartedAt.toISOString(),
            sessionId: inviteResult.id,
            createdBy: userId,
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
                sessionId: inviteResult.id,
                link: inviteResult.link,
            },
            aiQuality: verified,
            qa: {
                pageStatus: qaPage.status,
                exportRecordCount: qaExport.body.records.length,
            },
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

function flattenGeneratedQuestions(generated) {
    const questions = [];
    for (const [category, text] of Object.entries(generated?.behavioral ?? {})) {
        if (typeof text === "string" && text.trim()) {
            questions.push({ text, category });
        }
    }
    for (const [category, text] of Object.entries(generated?.culture ?? {})) {
        if (typeof text === "string" && text.trim()) {
            questions.push({ text, category });
        }
    }
    for (const item of generated?.technical ?? []) {
        if (typeof item?.text === "string" && item.text.trim()) {
            questions.push({ text: item.text, category: "Technical" });
        }
    }

    const selected = questions.slice(0, 3);
    if (selected.length === 0) {
        throw new Error("Question generation returned no usable questions.");
    }

    return selected.map((question, index) => ({
        ...question,
        index,
    }));
}

function buildInvitePayload(suffix, jobDescription, resumeText, questions) {
    return {
        role: "Warehouse Associate",
        jobDescription,
        candidates: [
            {
                firstName: "Gemini",
                lastName: "Smoke",
                email: `gemini.smoke+${suffix}@example.com`,
                reqId: `SMOKE-AI-${suffix}`,
                resumeText,
            },
        ],
        questions,
    };
}

async function verifyAiGenerationRows(pool, expected) {
    const result = await pool.query(
        `
            select
                surface,
                status,
                model_provider,
                model_name,
                count(*)::int as count,
                max(created_at) as latest_created_at
            from public.ai_generations
            where created_at >= $1::timestamptz
              and (
                session_id = $2
                or created_by = $3
              )
            group by surface, status, model_provider, model_name
            order by surface, status, model_provider, model_name
        `,
        [expected.since, expected.sessionId, expected.createdBy]
    );

    const rows = result.rows;
    for (const surface of EXPECTED_SURFACES) {
        const match = rows.find((row) =>
            row.surface === surface
            && row.status === "success"
            && row.model_provider === EXPECTED_PROVIDER
            && row.model_name === EXPECTED_MODEL
        );

        if (!match) {
            throw new Error(`Missing successful ${EXPECTED_PROVIDER}/${EXPECTED_MODEL} ai_generations row for surface "${surface}". Rows: ${JSON.stringify(rows)}`);
        }
    }

    return {
        expectedProvider: EXPECTED_PROVIDER,
        expectedModel: EXPECTED_MODEL,
        surfaces: EXPECTED_SURFACES.map((surface) => {
            const matches = rows.filter((row) => row.surface === surface);
            return {
                surface,
                rows: matches.map((row) => ({
                    status: row.status,
                    modelProvider: row.model_provider,
                    modelName: row.model_name,
                    count: row.count,
                    latestCreatedAt: row.latest_created_at,
                })),
            };
        }),
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
  npm run postgres:smoke:ai
  node scripts/smoke-postgres-ai-surfaces.mjs --base-url http://127.0.0.1:3100 --smoke-defaults

Defaults:
  base URL: ${DEFAULT_BASE_URL}
  recruiter email: ${DEFAULT_EMAIL}
  password: APP_USER_PASSWORD or ${DEFAULT_PASSWORD}

Notes:
  Start the app separately with the Postgres smoke env values plus GEMINI_API_KEY before running this script.
  This smoke covers real provider AI capture for question_generation, hint, strong_response, answer_feedback, and session_debrief.
  It does not send email.
`);
}

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
    const recipientEmail = options.recipientEmail || process.env.SMOKE_EMAIL_RECIPIENT || process.env.SMTP_USERNAME;
    const databaseUrl = options.smokeDefaults ? getSmokeDatabaseUrl() : (process.env.DATABASE_URL || getSmokeDatabaseUrl());
    const suffix = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

    if (!recipientEmail) {
        throw new Error("Provide --recipient-email, SMOKE_EMAIL_RECIPIENT, or SMTP_USERNAME for the real email smoke.");
    }

    assertSmtpEnv();

    const pool = new Pool({
        connectionString: databaseUrl,
        application_name: "interview-coach-email-smoke",
        max: 2,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
    });

    try {
        console.log(`Running Postgres email smoke against ${baseUrl}`);

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

        const invitePayload = buildInvitePayload(suffix, recipientEmail);
        const createInvite = await postJson(`${baseUrl}/api/recruiter/invites`, invitePayload, {
            Cookie: cookieHeader,
            "Idempotency-Key": `postgres-email-smoke-create-${suffix}`,
        });
        assertStatus(createInvite, 200, "invite creation");

        const inviteResult = createInvite.body?.results?.[0];
        if (!inviteResult?.id || !inviteResult?.link) {
            throw new Error(`Invite creation did not return a candidate link. Body: ${JSON.stringify(createInvite.body)}`);
        }

        const absoluteInviteLink = new URL(inviteResult.link, `${baseUrl}/`).toString();

        const sendInvite = await postJson(`${baseUrl}/api/invite/send`, {
            recipientEmail,
            recipientFirstName: inviteResult.firstName,
            role: invitePayload.role,
            inviteLink: absoluteInviteLink,
            recruiterName: "Fu Box",
            recruiterTitle: "Recruiter",
            recruiterCompany: "Rangam",
            recruiterEmail: process.env.SMTP_USERNAME,
            sessionIds: [inviteResult.id],
        }, {
            Cookie: cookieHeader,
        });
        assertStatus(sendInvite, 200, "initial invite email send");
        if (!sendInvite.body?.data?.id) {
            throw new Error(`Invite send did not return a provider message id. Body: ${JSON.stringify(sendInvite.body)}`);
        }

        const candidateToken = new URL(absoluteInviteLink).pathname.split("/").filter(Boolean).at(-1);
        if (!candidateToken) {
            throw new Error(`Could not extract candidate token from invite link: ${inviteResult.link}`);
        }

        let session = await getJson(`${baseUrl}/api/session/${inviteResult.id}`, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(session, 200, "candidate session fetch");
        const firstQuestion = session.body?.questions?.[0];
        if (!firstQuestion?.id) {
            throw new Error("Candidate session did not include a first question.");
        }

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

        const submit = await postJson(`${baseUrl}/api/session/${inviteResult.id}/questions/${firstQuestion.id}/submit`, {
            text: "I would check the pick ticket against the physical items, pause the shipment, notify a lead, and document the correction before handing it off.",
            modality: "text",
        }, {
            "x-candidate-token": candidateToken,
            "Idempotency-Key": `postgres-email-smoke-submit-${suffix}`,
        });
        assertStatus(submit, 200, "candidate answer submit");

        const analysis = await postJson(`${baseUrl}/api/session/${inviteResult.id}/questions/${firstQuestion.id}/analysis`, {}, {
            "x-candidate-token": candidateToken,
            "Idempotency-Key": `postgres-email-smoke-analysis-${suffix}`,
        });
        assertStatus(analysis, 200, "answer analysis");

        const completion = await patchJson(`${baseUrl}/api/session/${inviteResult.id}`, {
            currentQuestionIndex: session.body.questions.length,
            status: "COMPLETED",
        }, {
            "x-candidate-token": candidateToken,
        });
        assertStatus(completion, 200, "session completion and debrief email send");
        if (!completion.body?.summaryNarrative) {
            throw new Error("Session completion did not return a summary narrative.");
        }

        const verified = await verifyDatabaseRows(pool, {
            sessionId: inviteResult.id,
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
                inviteMessageId: sendInvite.body.data.id,
            },
            email: {
                provider: "smtp",
                inviteAccepted: true,
                debriefAccepted: verified.summaryExpiresAtPresent,
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

        if (arg === "--recipient-email") {
            options.recipientEmail = args[++index];
            if (!options.recipientEmail) throw new Error("Missing value for --recipient-email.");
            continue;
        }

        if (arg.startsWith("--recipient-email=")) {
            options.recipientEmail = arg.slice("--recipient-email=".length);
            continue;
        }

        throw new Error(`Unknown option "${arg}".`);
    }

    return options;
}

function buildInvitePayload(suffix, recipientEmail) {
    return {
        role: "Warehouse Associate",
        jobDescription: "Support a busy warehouse team by picking, packing, documenting inventory movement, following safety procedures, and communicating clearly when priorities change.",
        candidates: [
            {
                firstName: "Email",
                lastName: "Smoke",
                email: recipientEmail,
                reqId: `SMOKE-EMAIL-${suffix}`,
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
    const [session, inviteMetric, debriefMetric] = await Promise.all([
        pool.query(
            `
                select
                    invitation_sent_at,
                    summary_narrative,
                    intake_json
                from public.sessions
                where session_id = $1
                limit 1
            `,
            [expected.sessionId]
        ),
        pool.query(
            `
                select coalesce(sum(value), 0)::int as count
                from public.metric_counter_rollups
                where metric_name = 'invite_send_total'
                  and tags @> '{"outcome":"success"}'::jsonb
            `
        ),
        pool.query(
            `
                select coalesce(sum(value), 0)::int as count
                from public.metric_counter_rollups
                where metric_name = 'session_completion_total'
                  and tags @> '{"outcome":"success"}'::jsonb
            `
        ),
    ]);

    const sessionRow = session.rows[0];
    if (!sessionRow) {
        throw new Error("Missing session row after email smoke.");
    }

    if (!sessionRow.invitation_sent_at) {
        throw new Error("Initial invite send did not mark invitation_sent_at.");
    }

    if (!sessionRow.summary_narrative) {
        throw new Error("Session completion did not persist summary_narrative.");
    }

    if (!sessionRow.intake_json?.summary_expires_at) {
        throw new Error("Debrief email send did not set summary_expires_at.");
    }

    assertMinimum(inviteMetric.rows[0]?.count, 1, "invite send success metric");
    assertMinimum(debriefMetric.rows[0]?.count, 1, "session completion success metric");

    return {
        invitationSentAt: sessionRow.invitation_sent_at,
        summaryNarrativePresent: Boolean(sessionRow.summary_narrative),
        summaryExpiresAtPresent: Boolean(sessionRow.intake_json?.summary_expires_at),
        inviteSendSuccessMetricCount: inviteMetric.rows[0].count,
        sessionCompletionSuccessMetricCount: debriefMetric.rows[0].count,
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

function assertSmtpEnv() {
    const missing = ["SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"]
        .filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing SMTP env values for real email smoke: ${missing.join(", ")}`);
    }
}

function assertStatus(result, expectedStatus, label) {
    if (result.response.status !== expectedStatus) {
        throw new Error(`${label} returned ${result.response.status}; expected ${expectedStatus}. Body: ${JSON.stringify(result.body)}`);
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
  npm run postgres:smoke:email
  node scripts/smoke-postgres-email-flow.mjs --base-url http://127.0.0.1:3100 --smoke-defaults

Defaults:
  base URL: ${DEFAULT_BASE_URL}
  recruiter email: ${DEFAULT_EMAIL}
  password: APP_USER_PASSWORD or ${DEFAULT_PASSWORD}
  recipient: SMOKE_EMAIL_RECIPIENT or SMTP_USERNAME

Notes:
  Start the app separately with the Postgres smoke env values plus real SMTP_* values before running this script.
  This smoke sends real email through the configured SMTP provider.
`);
}

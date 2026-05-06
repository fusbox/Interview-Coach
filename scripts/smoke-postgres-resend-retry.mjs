#!/usr/bin/env node
import { randomUUID } from "crypto";
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
        throw new Error("Provide --recipient-email, SMOKE_EMAIL_RECIPIENT, or SMTP_USERNAME for the resend email smoke.");
    }

    const pool = new Pool({
        connectionString: databaseUrl,
        application_name: "interview-coach-resend-retry-smoke",
        max: 2,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
    });

    try {
        console.log(`Running Postgres resend/retry smoke against ${baseUrl}`);

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

        const invitePayload = buildInvitePayload(suffix, recipientEmail);
        const createInvite = await postJson(`${baseUrl}/api/recruiter/invites`, invitePayload, {
            Cookie: cookieHeader,
            "Idempotency-Key": `postgres-resend-retry-create-${suffix}`,
        });
        assertStatus(createInvite, 200, "invite creation for resend");

        const inviteResult = createInvite.body?.results?.[0];
        if (!inviteResult?.id || !inviteResult?.link) {
            throw new Error(`Invite creation did not return a candidate link. Body: ${JSON.stringify(createInvite.body)}`);
        }

        const resend = await postJson(`${baseUrl}/api/invite/resend`, {
            sessionId: inviteResult.id,
            recruiterName: "Fu Box",
            recruiterTitle: "Recruiter",
            recruiterCompany: "Rangam",
            recruiterEmail: email,
        }, {
            Cookie: cookieHeader,
        });
        assertStatus(resend, 200, "invite resend");
        if (!resend.body?.data?.id) {
            throw new Error(`Invite resend did not return a provider message id. Body: ${JSON.stringify(resend.body)}`);
        }

        const resendVerified = await verifyResend(pool, {
            sessionId: inviteResult.id,
        });

        const failedBatch = await seedRetryableFailedBatch(pool, {
            userId,
            suffix,
            recipientEmail,
        });

        const retry = await postJson(`${baseUrl}/api/recruiter/invites/${failedBatch.batchId}/retry`, {}, {
            Cookie: cookieHeader,
            "Idempotency-Key": `postgres-resend-retry-retry-${suffix}`,
        });
        assertStatus(retry, 200, "invite batch retry");

        if (retry.body?.retriedFromBatchId !== failedBatch.batchId) {
            throw new Error(`Retry response retriedFromBatchId was ${retry.body?.retriedFromBatchId}; expected ${failedBatch.batchId}.`);
        }
        if (!retry.body?.batchId || retry.body.batchId === failedBatch.batchId) {
            throw new Error(`Retry response did not include a distinct child batch id. Body: ${JSON.stringify(retry.body)}`);
        }
        if (retry.body?.summary?.succeeded !== 1 || retry.body?.summary?.failed !== 0) {
            throw new Error(`Retry summary was not a clean success. Body: ${JSON.stringify(retry.body)}`);
        }

        const retryVerified = await verifyRetry(pool, {
            parentBatchId: failedBatch.batchId,
            childBatchId: retry.body.batchId,
            userId,
        });

        console.log(JSON.stringify({
            ok: true,
            baseUrl,
            user: {
                id: userId,
                email,
            },
            resend: {
                sessionId: inviteResult.id,
                providerMessageId: resend.body.data.id,
                database: resendVerified,
            },
            retry: {
                parentBatchId: failedBatch.batchId,
                childBatchId: retry.body.batchId,
                database: retryVerified,
            },
        }, null, 2));
    } finally {
        await pool.end();
    }
}

function buildInvitePayload(suffix, recipientEmail) {
    return {
        role: "Warehouse Associate",
        jobDescription: "Support a busy warehouse team by picking, packing, documenting inventory movement, following safety procedures, and communicating clearly when priorities change.",
        candidates: [
            {
                firstName: "Smoke",
                lastName: "Resend",
                email: recipientEmail,
                reqId: `SMOKE-RESEND-${suffix}`,
                resumeText: "Warehouse associate with experience in inventory checks, packing accuracy, safety procedures, and shift handoffs.",
            },
        ],
        questions: [
            {
                text: "Tell me about a time you caught an inventory or packing mistake before it reached a customer.",
                category: "Behavioral",
                index: 0,
            },
        ],
    };
}

async function verifyResend(pool, expected) {
    const [session, metrics] = await Promise.all([
        pool.query(
            "select invitation_sent_at from public.sessions where session_id = $1",
            [expected.sessionId]
        ),
        pool.query(
            `
                select coalesce(sum(value), 0)::int as count
                from public.metric_counter_rollups
                where metric_name = 'invite_resend_total'
                  and tags @> '{"outcome":"success"}'::jsonb
            `
        ),
    ]);

    const row = session.rows[0];
    if (!row?.invitation_sent_at) {
        throw new Error(`Session ${expected.sessionId} did not have invitation_sent_at after resend.`);
    }

    return {
        invitationSentAt: new Date(row.invitation_sent_at).toISOString(),
        inviteResendSuccessMetricCount: metrics.rows[0]?.count ?? 0,
    };
}

async function seedRetryableFailedBatch(pool, params) {
    const batchId = randomUUID();
    const questions = [{
        text: "What steps would you take if a scanner count did not match the physical items in front of you?",
        category: "Technical",
        index: 0,
    }];

    await pool.query(
        `
            insert into public.invite_batches (
                batch_id,
                created_by,
                role,
                job_description,
                questions_json,
                status,
                requested_count,
                succeeded_count,
                failed_count
            )
            values ($1, $2, 'Warehouse Associate', $3, $4::jsonb, 'failed', 1, 0, 1)
        `,
        [
            batchId,
            params.userId,
            "Smoke-seeded retryable failure for route-stack validation.",
            JSON.stringify(questions),
        ]
    );

    await pool.query(
        `
            insert into public.invite_batch_candidates (
                batch_id,
                candidate_index,
                first_name,
                last_name,
                email,
                req_id,
                resume_text,
                status,
                retryable,
                retry_count,
                error_code,
                error_message
            )
            values ($1, 0, 'Smoke', 'Retry', $2, $3, $4, 'failed', true, 0, 'INVITE_CREATE_FAILED', 'Seeded smoke failure')
        `,
        [
            batchId,
            params.recipientEmail,
            `SMOKE-RETRY-${params.suffix}`,
            "Warehouse associate resume text for retry smoke.",
        ]
    );

    return { batchId };
}

async function verifyRetry(pool, expected) {
    const [parent, parentCandidate, child, childCandidate, childSessions, idempotency] = await Promise.all([
        pool.query(
            "select status, last_retry_batch_id from public.invite_batches where batch_id = $1 and created_by = $2",
            [expected.parentBatchId, expected.userId]
        ),
        pool.query(
            "select status, retryable, retry_count from public.invite_batch_candidates where batch_id = $1 and candidate_index = 0",
            [expected.parentBatchId]
        ),
        pool.query(
            "select parent_batch_id, status, requested_count, succeeded_count, failed_count from public.invite_batches where batch_id = $1 and created_by = $2",
            [expected.childBatchId, expected.userId]
        ),
        pool.query(
            "select status, session_id from public.invite_batch_candidates where batch_id = $1 and candidate_index = 0",
            [expected.childBatchId]
        ),
        pool.query(
            `
                select count(*)::int as session_count
                from public.sessions s
                inner join public.invite_batch_candidates c on c.session_id = s.session_id
                where c.batch_id = $1
            `,
            [expected.childBatchId]
        ),
        pool.query(
            `
                select count(*)::int as count
                from public.api_idempotency_keys
                where scope = 'recruiter_invites:retry'
                  and actor_id = $1
                  and status = 'completed'
            `,
            [expected.userId]
        ),
    ]);

    const parentRow = parent.rows[0];
    const parentCandidateRow = parentCandidate.rows[0];
    const childRow = child.rows[0];
    const childCandidateRow = childCandidate.rows[0];

    if (parentRow?.status !== "retry_issued" || parentRow.last_retry_batch_id !== expected.childBatchId) {
        throw new Error(`Parent batch retry state is incorrect: ${JSON.stringify(parentRow)}`);
    }

    if (parentCandidateRow?.status !== "retry_issued" || parentCandidateRow.retryable !== false || Number(parentCandidateRow.retry_count) !== 1) {
        throw new Error(`Parent candidate retry state is incorrect: ${JSON.stringify(parentCandidateRow)}`);
    }

    if (childRow?.parent_batch_id !== expected.parentBatchId || childRow.status !== "completed" || Number(childRow.succeeded_count) !== 1 || Number(childRow.failed_count) !== 0) {
        throw new Error(`Child batch state is incorrect: ${JSON.stringify(childRow)}`);
    }

    if (childCandidateRow?.status !== "created" || !childCandidateRow.session_id) {
        throw new Error(`Child candidate state is incorrect: ${JSON.stringify(childCandidateRow)}`);
    }

    if (Number(childSessions.rows[0]?.session_count) !== 1) {
        throw new Error(`Child batch did not create exactly one session. Row: ${JSON.stringify(childSessions.rows[0])}`);
    }

    return {
        parentStatus: parentRow.status,
        childStatus: childRow.status,
        childSessionId: childCandidateRow.session_id,
        completedRetryIdempotencyRows: idempotency.rows[0]?.count ?? 0,
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

        if (arg === "--recipient-email") {
            options.recipientEmail = args[++index];
            if (!options.recipientEmail) throw new Error("Missing value for --recipient-email.");
            continue;
        }

        throw new Error(`Unknown option "${arg}".`);
    }

    return options;
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

function extractCookieHeader(headers) {
    const setCookie = headers.getSetCookie ? headers.getSetCookie() : [];
    return setCookie.map((cookie) => cookie.split(";")[0]).join("; ");
}

function trimTrailingSlash(value) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
}

function printUsage() {
    console.log(`
Usage: node scripts/smoke-postgres-resend-retry.mjs [options]

Options:
  --smoke-defaults             Use the disposable Postgres smoke database URL.
  --base-url <url>             App base URL. Defaults to ${DEFAULT_BASE_URL}.
  --email <email>              Recruiter login email. Defaults to ${DEFAULT_EMAIL}.
  --password <password>        Recruiter login password. Defaults to APP_USER_PASSWORD or local smoke default.
  --recipient-email <email>    Email recipient for the real resend smoke.
`);
}

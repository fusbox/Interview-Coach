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
        application_name: "interview-coach-profile-settings-smoke",
        max: 2,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
    });

    try {
        console.log(`Running Postgres profile/settings smoke against ${baseUrl}`);

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

        const settingsPage = await fetch(`${baseUrl}/recruiter/settings`, {
            headers: { Cookie: cookieHeader },
        });
        if (settingsPage.status !== 200) {
            throw new Error(`Settings page returned ${settingsPage.status}; expected 200.`);
        }

        const current = await getJson(`${baseUrl}/api/recruiter/profile`, {
            Cookie: cookieHeader,
        });
        assertStatus(current, 200, "profile fetch");
        if (current.body?.user?.id !== userId) {
            throw new Error(`Profile fetch returned user ${current.body?.user?.id}; expected ${userId}.`);
        }

        const originalProfile = normalizeProfile(current.body?.profile, userId);
        const updatedProfile = {
            first_name: "Smoke",
            last_name: "Settings",
            title: `Profile Smoke ${suffix}`,
            phone: "(555) 010-9900",
            timezone: "America/New_York",
        };

        const update = await putJson(`${baseUrl}/api/recruiter/profile`, updatedProfile, {
            Cookie: cookieHeader,
        });
        assertStatus(update, 200, "profile update");
        assertProfile(update.body?.profile, {
            recruiter_id: userId,
            ...updatedProfile,
        }, "profile update response");

        const afterUpdate = await getJson(`${baseUrl}/api/recruiter/profile`, {
            Cookie: cookieHeader,
        });
        assertStatus(afterUpdate, 200, "profile refetch after update");
        assertProfile(afterUpdate.body?.profile, {
            recruiter_id: userId,
            ...updatedProfile,
        }, "profile refetch response");

        const dbAfterUpdate = await verifyDatabaseProfile(pool, {
            recruiterId: userId,
            ...updatedProfile,
        });

        const restore = await putJson(`${baseUrl}/api/recruiter/profile`, {
            first_name: originalProfile.first_name || "Fu",
            last_name: originalProfile.last_name || "Box",
            title: originalProfile.title || "",
            phone: originalProfile.phone || "",
            timezone: originalProfile.timezone || "America/Chicago",
        }, {
            Cookie: cookieHeader,
        });
        assertStatus(restore, 200, "profile restore");

        console.log(JSON.stringify({
            ok: true,
            baseUrl,
            user: {
                id: userId,
                email,
            },
            profileSettings: {
                pageStatus: settingsPage.status,
                updateTitle: updatedProfile.title,
                restored: true,
            },
            database: dbAfterUpdate,
        }, null, 2));
    } finally {
        await pool.end();
    }
}

function normalizeProfile(profile, userId) {
    return {
        recruiter_id: profile?.recruiter_id || userId,
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
        title: profile?.title || "",
        phone: profile?.phone || "",
        timezone: profile?.timezone || "UTC",
    };
}

function assertProfile(actual, expected, label) {
    if (!actual) {
        throw new Error(`${label} did not include a profile.`);
    }

    for (const [key, value] of Object.entries(expected)) {
        if ((actual[key] ?? "") !== value) {
            throw new Error(`${label} ${key} was ${actual[key]}; expected ${value}.`);
        }
    }
}

async function verifyDatabaseProfile(pool, expected) {
    const result = await pool.query(
        `
            select recruiter_id, first_name, last_name, title, phone, timezone
            from public.recruiter_profiles
            where recruiter_id = $1
            limit 1
        `,
        [expected.recruiterId]
    );

    const row = result.rows[0];
    if (!row) {
        throw new Error(`Missing recruiter profile row for ${expected.recruiterId}.`);
    }

    assertProfile(row, {
        recruiter_id: expected.recruiterId,
        first_name: expected.first_name,
        last_name: expected.last_name,
        title: expected.title,
        phone: expected.phone,
        timezone: expected.timezone,
    }, "database profile row");

    return {
        recruiterId: row.recruiter_id,
        title: row.title,
        timezone: row.timezone,
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

function extractCookieHeader(headers) {
    const setCookie = headers.getSetCookie ? headers.getSetCookie() : [];
    return setCookie.map((cookie) => cookie.split(";")[0]).join("; ");
}

function trimTrailingSlash(value) {
    return value.endsWith("/") ? value.slice(0, -1) : value;
}

function printUsage() {
    console.log(`
Usage: node scripts/smoke-postgres-profile-settings.mjs [options]

Options:
  --smoke-defaults       Use the disposable Postgres smoke database URL.
  --base-url <url>       App base URL. Defaults to ${DEFAULT_BASE_URL}.
  --email <email>        Recruiter login email. Defaults to ${DEFAULT_EMAIL}.
  --password <password>  Recruiter login password. Defaults to APP_USER_PASSWORD or local smoke default.
`);
}

#!/usr/bin/env node
import { Pool } from "pg";

const RUNTIME_ROLE = "interview_coach_runtime";

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});

async function main() {
    const migrationUrl = readRequiredEnv("DATABASE_MIGRATION_URL");
    const runtimePassword = readRequiredEnv("DATABASE_RUNTIME_PASSWORD");

    if (runtimePassword.length < 24) {
        throw new Error("DATABASE_RUNTIME_PASSWORD must be at least 24 characters.");
    }

    const adminPool = new Pool(buildPoolConfig(migrationUrl, "interview-coach-role-provisioner"));
    try {
        const roleResult = await adminPool.query(`
            select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
            from pg_roles
            where rolname = $1
        `, [RUNTIME_ROLE]);
        if (roleResult.rowCount !== 1) {
            throw new Error(
                "interview_coach_runtime does not exist. Apply migration 046 before provisioning its login.",
            );
        }

        const role = roleResult.rows[0];
        if (
            role.rolsuper
            || role.rolcreatedb
            || role.rolcreaterole
            || role.rolreplication
            || role.rolbypassrls
        ) {
            throw new Error("Refusing to provision a privileged runtime role.");
        }

        const passwordLiteral = runtimePassword.replaceAll("'", "''");
        await adminPool.query(
            `alter role ${RUNTIME_ROLE} with login password '${passwordLiteral}'`,
        );
    } finally {
        await adminPool.end();
    }

    const runtimeUrl = buildRuntimeUrl(migrationUrl, runtimePassword);
    const runtimePool = new Pool(buildPoolConfig(runtimeUrl, "interview-coach-runtime-probe"));
    try {
        const result = await runtimePool.query(`
            select
                current_user as role_name,
                has_schema_privilege(current_user, 'public', 'usage') as can_use_schema,
                has_schema_privilege(current_user, 'public', 'create') as can_create_in_schema,
                has_table_privilege(current_user, 'public.app_users', 'select') as can_read_app_users
        `);
        const probe = result.rows[0];
        if (
            probe.role_name !== RUNTIME_ROLE
            || probe.can_use_schema !== true
            || probe.can_create_in_schema !== false
            || probe.can_read_app_users !== true
        ) {
            throw new Error("Runtime role probe did not match the hardened permission contract.");
        }
    } finally {
        await runtimePool.end();
    }

    const target = new URL(migrationUrl);
    console.log(JSON.stringify({
        provisioned: true,
        role: RUNTIME_ROLE,
        host: target.hostname,
        port: target.port || "5432",
        database: target.pathname.slice(1),
        next: "Set Vercel DATABASE_URL to the runtime-role URI, then run npm run env:check:vercel.",
    }, null, 2));
}

function buildRuntimeUrl(migrationUrl, password) {
    const url = new URL(migrationUrl);
    const adminUsername = decodeURIComponent(url.username);
    const projectSuffix = adminUsername.includes(".")
        ? adminUsername.slice(adminUsername.indexOf("."))
        : "";

    url.username = `${RUNTIME_ROLE}${projectSuffix}`;
    url.password = password;
    return url.toString();
}

function buildPoolConfig(connectionString, applicationName) {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    let ssl;
    if (sslMode === "disable") {
        ssl = false;
    } else if (sslMode === "verify-ca" || sslMode === "verify-full") {
        ssl = { rejectUnauthorized: true };
    } else if (sslMode) {
        ssl = { rejectUnauthorized: false };
    }

    return {
        connectionString,
        ssl,
        max: 1,
        connectionTimeoutMillis: 10_000,
        statement_timeout: 15_000,
        query_timeout: 20_000,
        application_name: applicationName,
    };
}

function readRequiredEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable ${name}.`);
    }
    return value;
}

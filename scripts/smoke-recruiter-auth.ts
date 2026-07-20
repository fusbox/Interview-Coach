#!/usr/bin/env node
import { authenticateWithPassword, getUserBySessionToken, revokeAppSession } from "../src/features/recruiter-auth-v2/app-auth";
import { PostgresAppAuthStore } from "../src/features/recruiter-auth-v2/postgres-app-auth-store";
import { getSmokeDatabaseUrl } from "./smoke-postgres-config.mjs";
import { Pool } from "pg";

const EMAIL = "recruiter-dev@talentarbor.local";
const PASSWORD = "local-only-recruiter";

async function main() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Recruiter auth smoke is disabled when NODE_ENV=production.");
    }

    const pool = new Pool({ connectionString: getSmokeDatabaseUrl(), max: 1 });
    try {
        const store = new PostgresAppAuthStore(pool);
        const login = await authenticateWithPassword(
            EMAIL,
            PASSWORD,
            { userAgent: "recruiter-auth-smoke", ipAddress: "127.0.0.1" },
            { store },
        );
        if (!login.ok) throw new Error("Seeded recruiter could not authenticate.");
        if (!login.user.roles.includes("recruiter")) throw new Error("Seeded user lacks recruiter role.");

        const recovered = await getUserBySessionToken(login.sessionToken, { store });
        if (recovered?.id !== login.user.id) throw new Error("Recruiter session did not recover its owner.");

        await revokeAppSession(login.sessionToken, { userAgent: "recruiter-auth-smoke" }, { store });
        const afterRevocation = await getUserBySessionToken(login.sessionToken, { store });
        if (afterRevocation) throw new Error("Revoked recruiter session still resolves.");

        console.log(JSON.stringify({
            authenticated: true,
            recruiterRole: true,
            sessionRecovered: true,
            revocationEnforced: true,
            userId: login.user.id,
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});

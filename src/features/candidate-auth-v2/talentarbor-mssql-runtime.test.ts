// @vitest-environment node

import type { ConnectionPool } from "mssql";
import { describe, expect, it, vi } from "vitest";

import {
    TA_SQL_CONNECT_TIMEOUT_MS_ENV,
    TA_SQL_DATABASE_ENV,
    TA_SQL_ENCRYPT_ENV,
    TA_SQL_PASSWORD_ENV,
    TA_SQL_POOL_MAX_ENV,
    TA_SQL_PORT_ENV,
    TA_SQL_REQUEST_TIMEOUT_MS_ENV,
    TA_SQL_SERVER_ENV,
    TA_SQL_TRUST_SERVER_CERTIFICATE_ENV,
    TA_SQL_USER_ENV,
    createTalentArborMssqlReader,
    getTalentArborMssqlConfigStatus,
    type TalentArborMssqlConfig,
} from "./talentarbor-mssql-runtime";

describe("TalentArbor MSSQL runtime", () => {
    const requiredEnv = {
        [TA_SQL_SERVER_ENV]: "ta-sql.internal",
        [TA_SQL_DATABASE_ENV]: "TalentArbor",
        [TA_SQL_USER_ENV]: "interview_coach_reader",
        [TA_SQL_PASSWORD_ENV]: "server-only-password",
    };

    it("builds a bounded encrypted configuration with production-safe defaults", () => {
        expect(getTalentArborMssqlConfigStatus(requiredEnv)).toEqual({
            ok: true,
            config: {
                server: "ta-sql.internal",
                port: 1433,
                database: "TalentArbor",
                user: "interview_coach_reader",
                password: "server-only-password",
                encrypt: true,
                trustServerCertificate: false,
                connectTimeoutMs: 5000,
                requestTimeoutMs: 8000,
                poolMax: 4,
            },
        });
    });

    it("accepts explicit staging transport settings only when each value is valid and bounded", () => {
        expect(getTalentArborMssqlConfigStatus({
            ...requiredEnv,
            [TA_SQL_PORT_ENV]: "1434",
            [TA_SQL_ENCRYPT_ENV]: "false",
            [TA_SQL_TRUST_SERVER_CERTIFICATE_ENV]: "true",
            [TA_SQL_CONNECT_TIMEOUT_MS_ENV]: "10000",
            [TA_SQL_REQUEST_TIMEOUT_MS_ENV]: "12000",
            [TA_SQL_POOL_MAX_ENV]: "6",
        })).toMatchObject({
            ok: true,
            config: {
                port: 1434,
                encrypt: false,
                trustServerCertificate: true,
                connectTimeoutMs: 10000,
                requestTimeoutMs: 12000,
                poolMax: 6,
            },
        });

        expect(getTalentArborMssqlConfigStatus({
            ...requiredEnv,
            [TA_SQL_REQUEST_TIMEOUT_MS_ENV]: "15001",
        })).toEqual({ ok: false, reason: "invalid_request_timeout" });
        expect(getTalentArborMssqlConfigStatus({
            ...requiredEnv,
            [TA_SQL_POOL_MAX_ENV]: "0",
        })).toEqual({ ok: false, reason: "invalid_pool_max" });
        expect(getTalentArborMssqlConfigStatus({
            ...requiredEnv,
            [TA_SQL_TRUST_SERVER_CERTIFICATE_ENV]: "sometimes",
        })).toEqual({ ok: false, reason: "invalid_trust_server_certificate" });
    });

    it("fails closed when any required credential is absent", () => {
        expect(getTalentArborMssqlConfigStatus({
            ...requiredEnv,
            [TA_SQL_PASSWORD_ENV]: "",
        })).toEqual({ ok: false, reason: "missing_configuration" });
    });

    it("binds numeric identifiers as SQL parameters and selects only approved tables and columns", async () => {
        const input = vi.fn();
        const query = vi.fn(async (sql: string) => {
            void sql;
            return { recordset: [] };
        });
        const request = { input, query };
        input.mockReturnValue(request);
        const getPool = vi.fn(async () => ({
            request: () => request,
        }) as unknown as ConnectionPool);
        const reader = createTalentArborMssqlReader({
            config: createConfig(),
            getPool,
        });

        await reader.findCandidateById(123456);
        await reader.findOwnedJobContext(123456, 5551234);

        expect(input).toHaveBeenCalledWith("candidateId", expect.anything(), 123456);
        expect(input).toHaveBeenCalledWith("jobCollectionId", expect.anything(), 5551234);
        const identitySql = String(query.mock.calls[0][0]);
        const jobSql = String(query.mock.calls[1][0]);
        expect(identitySql).toContain("dbo.CandidateMaster");
        expect(jobSql).toContain("dbo.CandidateJobCollectionTxn");
        expect(jobSql).toContain("dbo.JobCollection");
        expect(`${identitySql}\n${jobSql}`).not.toContain("CreatedBy");
        expect(`${identitySql}\n${jobSql}`).not.toMatch(/Password|Salt|SSN|Birthdate|ResumeParserJSONMaster/i);
        expect(`${identitySql}\n${jobSql}`).not.toContain("123456");
        expect(`${identitySql}\n${jobSql}`).not.toContain("5551234");
    });
});

function createConfig(): TalentArborMssqlConfig {
    return {
        server: "ta-sql.internal",
        port: 1433,
        database: "TalentArbor",
        user: "interview_coach_reader",
        password: "server-only-password",
        encrypt: true,
        trustServerCertificate: false,
        connectTimeoutMs: 5000,
        requestTimeoutMs: 8000,
        poolMax: 4,
    };
}

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

    it("binds numeric identifiers as SQL parameters and executes job/resume SPs", async () => {
        const input = vi.fn();
        const query = vi.fn(async (sql: string) => {
            void sql;
            return { recordset: [] };
        });
        const execute = vi.fn(async (procedure: string) => {
            void procedure;
            return { recordset: [] };
        });
        const request = { input, query, execute };
        input.mockReturnValue(request);
        const getPool = vi.fn(async () => ({
            request: () => request,
        }) as unknown as ConnectionPool);
        const reader = createTalentArborMssqlReader({
            config: createConfig(),
            getPool,
        });

        await reader.findCandidateById(123456);
        await reader.findJobCollectionById(123456, 5551234);
        await reader.findRequirementById({
            candidateId: 123456,
            requirementId: 129571,
            clientId: 13,
            talentChannelId: 3,
        });
        await reader.findCandidateResumeHtml?.(123456);

        expect(input).toHaveBeenCalledWith("candidateId", expect.anything(), 123456);
        expect(input).toHaveBeenCalledWith("JobCollectionID", expect.anything(), 5551234);
        expect(input).toHaveBeenCalledWith("CandidateID", expect.anything(), 123456);
        expect(input).toHaveBeenCalledWith("RequirementID", expect.anything(), 129571);
        expect(input).toHaveBeenCalledWith("ClientID", expect.anything(), 13);
        expect(input).toHaveBeenCalledWith("TalentChannelID", expect.anything(), 3);
        expect(execute).toHaveBeenCalledWith("dbo.Usp_SC_GET_JobCollection_ById");
        expect(execute).toHaveBeenCalledWith("dbo.Usp_SC_JobSeeker_Get_JobRequirementDetails");
        expect(execute).toHaveBeenCalledWith("dbo.USP_AI_Get_CandidateHTMLResume");
        const identitySql = String(query.mock.calls[0][0]);
        expect(identitySql).toContain("dbo.CandidateMaster");
        expect(identitySql).not.toContain("CreatedBy");
        expect(identitySql).not.toMatch(/Password|Salt|SSN|Birthdate/i);
        expect(identitySql).not.toContain("123456");
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

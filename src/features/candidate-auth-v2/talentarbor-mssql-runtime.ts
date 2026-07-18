import { createHash } from "crypto";
import sql, { type ConnectionPool, type config as MssqlConfig } from "mssql";

import type {
    CandidateLaunchContextLookupInput,
    CandidateLaunchContextRow,
} from "./candidate-launch-context";
import {
    createTalentArborLaunchContextLookup,
    type TalentArborLaunchContextDiagnostic,
    type TalentArborLaunchContextReader,
} from "./talentarbor-launch-context-adapter";

export const TA_SQL_SERVER_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_SERVER";
export const TA_SQL_PORT_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_PORT";
export const TA_SQL_DATABASE_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_DATABASE";
export const TA_SQL_USER_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_USER";
export const TA_SQL_PASSWORD_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_PASSWORD";
export const TA_SQL_ENCRYPT_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_ENCRYPT";
export const TA_SQL_TRUST_SERVER_CERTIFICATE_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_TRUST_SERVER_CERTIFICATE";
export const TA_SQL_CONNECT_TIMEOUT_MS_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_CONNECT_TIMEOUT_MS";
export const TA_SQL_REQUEST_TIMEOUT_MS_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_REQUEST_TIMEOUT_MS";
export const TA_SQL_POOL_MAX_ENV = "CANDIDATE_HOST_LAUNCH_TA_SQL_POOL_MAX";

const DEFAULT_PORT = 1433;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_POOL_MAX = 4;
const MAX_TIMEOUT_MS = 15_000;
const MAX_POOL_SIZE = 10;

const CANDIDATE_IDENTITY_QUERY = `
select top (2)
  cm.CandidateID as candidateId,
  cast(null as int) as userId,
  cm.CompanyID as companyId,
  nullif(ltrim(rtrim(cm.Email)), '') as email,
  nullif(ltrim(rtrim(concat(
    nullif(ltrim(rtrim(cm.FirstName)), ''),
    case
      when nullif(ltrim(rtrim(cm.FirstName)), '') is not null
       and nullif(ltrim(rtrim(cm.LastName)), '') is not null then ' '
      else ''
    end,
    nullif(ltrim(rtrim(cm.LastName)), '')
  ))), '') as displayName,
  cast(null as int) as jobCollectionId
from dbo.CandidateMaster as cm
where cm.CandidateID = @candidateId;
`;

const OWNED_JOB_CONTEXT_QUERY = `
select top (2)
  cm.CandidateID as candidateId,
  cast(null as int) as userId,
  cm.CompanyID as companyId,
  nullif(ltrim(rtrim(cm.Email)), '') as email,
  nullif(ltrim(rtrim(concat(
    nullif(ltrim(rtrim(cm.FirstName)), ''),
    case
      when nullif(ltrim(rtrim(cm.FirstName)), '') is not null
       and nullif(ltrim(rtrim(cm.LastName)), '') is not null then ' '
      else ''
    end,
    nullif(ltrim(rtrim(cm.LastName)), '')
  ))), '') as displayName,
  jc.JobCollectionID as jobCollectionId,
  jc.JobTitle as jobTitle,
  jc.JobDescription as jobDescription,
  jc.Client as client,
  jc.Location as location,
  jc.IsActive as isActive,
  jc.IsExpired as isExpired,
  jc.ExpirationDate as expirationDate
from dbo.CandidateMaster as cm
inner join dbo.JobCollection as jc
  on jc.JobCollectionID = @jobCollectionId
where cm.CandidateID = @candidateId
  and exists (
    select 1
    from dbo.CandidateJobCollectionTxn as cjt
    where cjt.CandidateID = cm.CandidateID
      and cjt.JobCollectionID = jc.JobCollectionID
  );
`;

export type TalentArborMssqlRuntimeEnv = Record<string, string | undefined>;

export type TalentArborMssqlConfig = {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
    connectTimeoutMs: number;
    requestTimeoutMs: number;
    poolMax: number;
};

export type TalentArborMssqlConfigStatus =
    | { ok: true; config: TalentArborMssqlConfig }
    | {
        ok: false;
        reason:
            | "missing_configuration"
            | "invalid_port"
            | "invalid_encrypt"
            | "invalid_trust_server_certificate"
            | "invalid_connect_timeout"
            | "invalid_request_timeout"
            | "invalid_pool_max";
    };

export function getTalentArborMssqlConfigStatus(
    env: TalentArborMssqlRuntimeEnv = process.env,
): TalentArborMssqlConfigStatus {
    const server = env[TA_SQL_SERVER_ENV]?.trim();
    const database = env[TA_SQL_DATABASE_ENV]?.trim();
    const user = env[TA_SQL_USER_ENV]?.trim();
    const password = env[TA_SQL_PASSWORD_ENV];
    if (!server || !database || !user || !password) {
        return { ok: false, reason: "missing_configuration" };
    }

    const port = readBoundedInteger(env[TA_SQL_PORT_ENV], DEFAULT_PORT, 1, 65_535);
    if (port === null) {
        return { ok: false, reason: "invalid_port" };
    }
    const encrypt = readBoolean(env[TA_SQL_ENCRYPT_ENV], true);
    if (encrypt === null) {
        return { ok: false, reason: "invalid_encrypt" };
    }
    const trustServerCertificate = readBoolean(env[TA_SQL_TRUST_SERVER_CERTIFICATE_ENV], false);
    if (trustServerCertificate === null) {
        return { ok: false, reason: "invalid_trust_server_certificate" };
    }
    const connectTimeoutMs = readBoundedInteger(
        env[TA_SQL_CONNECT_TIMEOUT_MS_ENV],
        DEFAULT_CONNECT_TIMEOUT_MS,
        1_000,
        MAX_TIMEOUT_MS,
    );
    if (connectTimeoutMs === null) {
        return { ok: false, reason: "invalid_connect_timeout" };
    }
    const requestTimeoutMs = readBoundedInteger(
        env[TA_SQL_REQUEST_TIMEOUT_MS_ENV],
        DEFAULT_REQUEST_TIMEOUT_MS,
        1_000,
        MAX_TIMEOUT_MS,
    );
    if (requestTimeoutMs === null) {
        return { ok: false, reason: "invalid_request_timeout" };
    }
    const poolMax = readBoundedInteger(env[TA_SQL_POOL_MAX_ENV], DEFAULT_POOL_MAX, 1, MAX_POOL_SIZE);
    if (poolMax === null) {
        return { ok: false, reason: "invalid_pool_max" };
    }

    return {
        ok: true,
        config: {
            server,
            port,
            database,
            user,
            password,
            encrypt,
            trustServerCertificate,
            connectTimeoutMs,
            requestTimeoutMs,
            poolMax,
        },
    };
}

export function createTalentArborMssqlLaunchContextLookup({
    config,
    onDiagnostic = logSafeDiagnostic,
    getPool = getSharedPool,
}: {
    config: TalentArborMssqlConfig;
    onDiagnostic?: (diagnostic: TalentArborLaunchContextDiagnostic) => void;
    getPool?: (config: TalentArborMssqlConfig) => Promise<ConnectionPool>;
}) {
    const reader = createTalentArborMssqlReader({ config, getPool });
    return createTalentArborLaunchContextLookup({ reader, onDiagnostic });
}

export function createTalentArborMssqlReader({
    config,
    getPool = getSharedPool,
}: {
    config: TalentArborMssqlConfig;
    getPool?: (config: TalentArborMssqlConfig) => Promise<ConnectionPool>;
}): TalentArborLaunchContextReader {
    return {
        async findCandidateById(candidateId) {
            const pool = await getPool(config);
            const request = pool.request();
            request.input("candidateId", sql.Int, candidateId);
            const result = await request.query<Record<string, unknown>>(CANDIDATE_IDENTITY_QUERY);
            return result.recordset;
        },
        async findOwnedJobContext(candidateId, jobCollectionId) {
            const pool = await getPool(config);
            const request = pool.request();
            request.input("candidateId", sql.Int, candidateId);
            request.input("jobCollectionId", sql.Int, jobCollectionId);
            const result = await request.query<Record<string, unknown>>(OWNED_JOB_CONTEXT_QUERY);
            return result.recordset;
        },
    };
}

type SharedPoolState = {
    fingerprint: string;
    promise: Promise<ConnectionPool>;
};

let sharedPoolState: SharedPoolState | null = null;

async function getSharedPool(config: TalentArborMssqlConfig) {
    const fingerprint = fingerprintConfig(config);
    if (sharedPoolState?.fingerprint === fingerprint) {
        return sharedPoolState.promise;
    }

    const previous = sharedPoolState;
    const pool = new sql.ConnectionPool(toMssqlConfig(config));
    const promise = pool.connect().catch((error) => {
        if (sharedPoolState?.promise === promise) {
            sharedPoolState = null;
        }
        throw error;
    });
    sharedPoolState = { fingerprint, promise };

    if (previous) {
        void previous.promise.then((previousPool) => previousPool.close()).catch(() => undefined);
    }

    return promise;
}

function toMssqlConfig(config: TalentArborMssqlConfig): MssqlConfig {
    return {
        server: config.server,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionTimeout: config.connectTimeoutMs,
        requestTimeout: config.requestTimeoutMs,
        pool: {
            min: 0,
            max: config.poolMax,
            idleTimeoutMillis: 30_000,
        },
        options: {
            encrypt: config.encrypt,
            trustServerCertificate: config.trustServerCertificate,
            enableArithAbort: true,
        },
    };
}

function fingerprintConfig(config: TalentArborMssqlConfig) {
    return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}

function readBoundedInteger(
    value: string | undefined,
    fallback: number,
    minimum: number,
    maximum: number,
) {
    if (value === undefined) {
        return fallback;
    }
    if (!/^\d+$/.test(value.trim())) {
        return null;
    }
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function readBoolean(value: string | undefined, fallback: boolean) {
    if (value === undefined) {
        return fallback;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
        return true;
    }
    if (normalized === "false") {
        return false;
    }
    return null;
}

function logSafeDiagnostic(diagnostic: TalentArborLaunchContextDiagnostic) {
    console.warn("[candidate-host-launch] TalentArbor context lookup denied", diagnostic);
}

export type TalentArborLaunchContextLookup = (
    input: CandidateLaunchContextLookupInput,
) => Promise<CandidateLaunchContextRow>;

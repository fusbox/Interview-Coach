#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEPLOYMENT_ENV_TARGETS = [
    "vercel-app",
    "host-launch",
    "ai-eval-worker",
    "ai-eval-retention",
] as const;

export type DeploymentEnvTarget = typeof DEPLOYMENT_ENV_TARGETS[number];

export const AZURE_STAGING_ENV_TARGETS = [
    "vercel-app",
    "host-launch",
] as const satisfies readonly DeploymentEnvTarget[];

export type DeploymentEnvFinding = {
    target: DeploymentEnvTarget;
    variable: string;
    code: string;
    message: string;
};

export type DeploymentEnvValidationResult = {
    ok: boolean;
    targets: DeploymentEnvTarget[];
    checkedVariables: string[];
    redactedVariables: string[];
    errors: DeploymentEnvFinding[];
    warnings: DeploymentEnvFinding[];
};

type Environment = Readonly<Record<string, string | undefined>>;
type MutableValidation = {
    checked: Set<string>;
    redacted: Set<string>;
    allowRedactedValues: boolean;
    errors: DeploymentEnvFinding[];
    warnings: DeploymentEnvFinding[];
};

const PROVIDER_IDENTITIES = Object.freeze({
    CANDIDATE_QUESTION_WORDING_PROVIDER: "google_genai",
    CANDIDATE_QUESTION_WORDING_PROFILE: "google_gemini_2_5_flash_question_wording_v2",
    CANDIDATE_QUESTION_ASSISTANCE_PROVIDER: "google_genai",
    CANDIDATE_QUESTION_ASSISTANCE_PROFILE: "google_gemini_2_5_flash_question_assistance_v1",
    CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
    CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
    CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai",
    CANDIDATE_COACH_UPDATE_PROFILE: "google_gemini_2_5_flash_coach_update_v4",
    SESSION_QUESTION_AUDIO_PROVIDER: "google_genai",
    SESSION_QUESTION_AUDIO_PROFILE: "google_gemini_2_5_flash_tts_v1",
    SESSION_VOICE_TRANSCRIPTION_PROVIDER: "google_genai",
    SESSION_VOICE_TRANSCRIPTION_PROFILE: "google_gemini_2_5_flash_voice_transcription_v1",
    CANDIDATE_RESUME_OCR_PROVIDER: "google_genai",
    CANDIDATE_RESUME_OCR_PROFILE: "google_gemini_2_5_flash_resume_photo_ocr_v1",
} as const);

const LOCAL_ONLY_PRODUCTION_KEYS = [
    "CANDIDATE_HOST_LAUNCH_DEV_SECRET",
    "CANDIDATE_ANSWER_ANALYSIS_FAULT_MODE",
    "CANDIDATE_COACH_UPDATE_FAULT_MODE",
    "CANDIDATE_QUESTION_WORDING_FAULT_MODE",
    "CANDIDATE_COACH_UPDATE_LIVE_TEST",
    "CANDIDATE_EVALUATOR_LIVE_TEST",
    "CANDIDATE_QUESTION_WORDING_LIVE_TEST",
    "SESSION_VOICE_TRANSCRIPTION_LIVE_TEST",
] as const;

const LOCAL_ONLY_BOOLEAN_KEYS = [
    "CANDIDATE_RESUME_OCR_FIXTURE_ENABLED",
    "SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED",
] as const;

export function validateDeploymentEnvironment(input: {
    env: Environment;
    targets?: readonly DeploymentEnvTarget[];
    allowRedactedValues?: boolean;
}): DeploymentEnvValidationResult {
    const targets = normalizeTargets(input.targets);
    const state: MutableValidation = {
        checked: new Set(),
        redacted: new Set(),
        allowRedactedValues: input.allowRedactedValues === true,
        errors: [],
        warnings: [],
    };

    for (const target of targets) {
        if (target === "vercel-app") validateVercelApp(input.env, state);
        if (target === "host-launch") validateHostLaunch(input.env, state);
        if (target === "ai-eval-worker") validateAiEvalWorker(input.env, state);
        if (target === "ai-eval-retention") validateAiEvalRetention(input.env, state);
    }

    return {
        ok: state.errors.length === 0,
        targets,
        checkedVariables: Array.from(state.checked).sort(),
        redactedVariables: Array.from(state.redacted).sort(),
        errors: state.errors,
        warnings: state.warnings,
    };
}

export function parseEnvFileContents(contents: string): Record<string, string> {
    const parsed: Record<string, string> = {};
    const lines = contents.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[index];
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const assignment = line.startsWith("export ") ? line.slice(7).trimStart() : line;
        const separator = assignment.indexOf("=");
        if (separator <= 0) {
            throw new Error(`Invalid environment assignment on line ${index + 1}.`);
        }
        const key = assignment.slice(0, separator).trim();
        if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
            throw new Error(`Invalid environment variable name on line ${index + 1}.`);
        }
        parsed[key] = parseEnvValue(assignment.slice(separator + 1).trim());
    }
    return parsed;
}

function validateVercelApp(env: Environment, state: MutableValidation) {
    const target = "vercel-app" as const;
    validateDatabaseUrl(env, state, target);
    const appOrigin = validateHttpsOrigin(env, state, target, "NEXT_PUBLIC_APP_URL");
    const candidateOrigin = validateHttpsOrigin(env, state, target, "CANDIDATE_ACCOUNT_PUBLIC_ORIGIN");
    if (appOrigin && candidateOrigin && appOrigin !== candidateOrigin) {
        addError(
            state,
            target,
            "CANDIDATE_ACCOUNT_PUBLIC_ORIGIN",
            "ORIGIN_MISMATCH",
            "Candidate and invitation origins must use the same canonical deployment origin.",
        );
    }

    requireSecret(env, state, target, "ENCRYPTION_SECRET", 32);
    requireSecret(env, state, target, "GEMINI_API_KEY", 10);
    requireExact(env, state, target, "AUTH_COOKIE_NAME", "ic_app_session");
    requireExact(env, state, target, "CANDIDATE_ACCOUNT_EMAIL_PROVIDER", "smtp");
    requireExact(env, state, target, "RECRUITER_INVITATION_DELIVERY_PROVIDER", "smtp");
    requireNonempty(env, state, target, "SMTP_HOST");
    requireInteger(env, state, target, "SMTP_PORT", 1, 65_535);
    requireNonempty(env, state, target, "SMTP_USERNAME");
    requireSecret(env, state, target, "SMTP_PASSWORD", 1);
    requireEmailLike(env, state, target, "SMTP_FROM_EMAIL");
    requireEmailLike(env, state, target, "CANDIDATE_ACCOUNT_FROM_EMAIL");

    requireInteger(env, state, target, "APP_SESSION_TTL_SECONDS", 1, 31_536_000);
    requireInteger(env, state, target, "RECRUITER_INVITE_TOKEN_TTL_SECONDS", 1, 31_536_000);
    requireInteger(env, state, target, "INVITED_PRACTICE_ACCESS_TTL_SECONDS", 1, 31_536_000);
    requireInteger(env, state, target, "CANDIDATE_EMAIL_VERIFICATION_TTL_SECONDS", 60, 604_800);
    requireInteger(env, state, target, "CANDIDATE_PASSWORD_RESET_TTL_SECONDS", 60, 86_400);

    for (const variable of [
        "CANDIDATE_TERMS_VERSION",
        "CANDIDATE_PRIVACY_VERSION",
        "CANDIDATE_COOKIE_VERSION",
        "CANDIDATE_RESPONSIBLE_AI_VERSION",
        "CANDIDATE_CONTACT_AUTHORIZATION_VERSION",
    ] as const) {
        requireVersion(env, state, target, variable);
    }

    for (const [variable, expected] of Object.entries(PROVIDER_IDENTITIES)) {
        requireExact(env, state, target, variable, expected);
    }

    requireExact(env, state, target, "CANDIDATE_HOST_LAUNCH_DEV_MODE", "false");
    requireExact(env, state, target, "CANDIDATE_ENGAGEMENT_REPORTING_ENABLED", "false");
    for (const variable of LOCAL_ONLY_PRODUCTION_KEYS) {
        requireAbsent(env, state, target, variable);
    }
    for (const variable of LOCAL_ONLY_BOOLEAN_KEYS) {
        requireFalseOrAbsent(env, state, target, variable);
    }

    validateOptionalInteger(env, state, target, "POSTGRES_POOL_MAX", 1, 20);
    validateOptionalInteger(env, state, target, "POSTGRES_CONNECTION_TIMEOUT_MS", 100, 60_000);
    validateOptionalInteger(env, state, target, "POSTGRES_IDLE_TIMEOUT_MS", 100, 300_000);
    validateOptionalInteger(env, state, target, "POSTGRES_STATEMENT_TIMEOUT_MS", 100, 120_000);
    validateOptionalInteger(env, state, target, "POSTGRES_QUERY_TIMEOUT_MS", 100, 120_000);
    validateOptionalEnum(env, state, target, "POSTGRES_SSL_MODE", [
        "allow",
        "prefer",
        "require",
        "verify-ca",
        "verify-full",
    ]);
    validateOptionalBoolean(env, state, target, "POSTGRES_SSL_REJECT_UNAUTHORIZED");
}

function validateHostLaunch(env: Environment, state: MutableValidation) {
    const target = "host-launch" as const;
    validateDatabaseUrl(env, state, target);
    requireExact(env, state, target, "CANDIDATE_HOST_LAUNCH_DEV_MODE", "false");
    requireAbsent(env, state, target, "CANDIDATE_HOST_LAUNCH_DEV_SECRET");
    requireSecret(env, state, target, "CANDIDATE_HOST_LAUNCH_SECRET", 32);
    requireNonempty(env, state, target, "CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER");
    requireExact(env, state, target, "CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE", "talentarbor");
    requireInteger(env, state, target, "CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS", 0, 300);
    requireInteger(env, state, target, "CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS", 1, 900);
    requireInteger(env, state, target, "CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS", 1, 604_800);

    requireNonempty(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_SERVER");
    requireInteger(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_PORT", 1, 65_535);
    requireNonempty(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_DATABASE");
    requireNonempty(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_USER");
    requireSecret(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_PASSWORD", 1);
    requireBoolean(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_ENCRYPT");
    requireBoolean(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_TRUST_SERVER_CERTIFICATE");
    requireInteger(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_CONNECT_TIMEOUT_MS", 100, 15_000);
    requireInteger(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_REQUEST_TIMEOUT_MS", 100, 15_000);
    requireInteger(env, state, target, "CANDIDATE_HOST_LAUNCH_TA_SQL_POOL_MAX", 1, 10);
}

function validateAiEvalWorker(env: Environment, state: MutableValidation) {
    const target = "ai-eval-worker" as const;
    validateDatabaseUrl(env, state, target);
    requireSecret(env, state, target, "GEMINI_API_KEY", 10);
    requireExact(env, state, target, "CANDIDATE_ANSWER_ANALYSIS_PROVIDER", "google_genai");
    requireExact(
        env,
        state,
        target,
        "CANDIDATE_ANSWER_ANALYSIS_PROFILE",
        "google_gemini_2_5_flash_v1",
    );
    requireExact(env, state, target, "CANDIDATE_COACH_UPDATE_PROVIDER", "google_genai");
    requireExact(
        env,
        state,
        target,
        "CANDIDATE_COACH_UPDATE_PROFILE",
        "google_gemini_2_5_flash_coach_update_v4",
    );
    requireExact(env, state, target, "AI_EVAL_SCENARIO_LIVE_ENABLED", "true");
    requirePositiveNumber(env, state, target, "AI_EVAL_SCENARIO_INPUT_USD_PER_MILLION_TOKENS");
    requirePositiveNumber(env, state, target, "AI_EVAL_SCENARIO_OUTPUT_USD_PER_MILLION_TOKENS");
    requirePositiveNumber(env, state, target, "AI_EVAL_SCENARIO_MAX_ESTIMATED_COST_USD");
    requireInteger(env, state, target, "AI_EVAL_SCENARIO_MAX_CALLS", 1, 100_000);
    requireInteger(env, state, target, "AI_EVAL_SCENARIO_LIVE_CONCURRENCY", 1, 4);
    requireWorkerId(env, state, target, "AI_EVAL_SCENARIO_WORKER_ID");
    requireInteger(env, state, target, "AI_EVAL_SCENARIO_WORKER_POLL_INTERVAL_MS", 250, 60_000);
    requireInteger(env, state, target, "AI_EVAL_SCENARIO_WORKER_ERROR_BACKOFF_MS", 1_000, 300_000);
    requireInteger(env, state, target, "AI_EVAL_SCENARIO_WORKER_MAX_CONSECUTIVE_ERRORS", 1, 100);
    requireNonempty(env, state, target, "AI_EVAL_SCENARIO_WORKER_HEALTH_HOST");
    requireInteger(env, state, target, "AI_EVAL_SCENARIO_WORKER_HEALTH_PORT", 1_024, 65_535);
}

function validateAiEvalRetention(env: Environment, state: MutableValidation) {
    const target = "ai-eval-retention" as const;
    validateDatabaseUrl(env, state, target);
    requireWorkerId(env, state, target, "AI_EVAL_SCENARIO_RETENTION_WORKER_ID");
}

function validateDatabaseUrl(env: Environment, state: MutableValidation, target: DeploymentEnvTarget) {
    const variable = "DATABASE_URL";
    const value = requireNonempty(env, state, target, variable);
    if (!value) return;
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        addError(state, target, variable, "INVALID_DATABASE_URL", "Must be a valid PostgreSQL URL.");
        return;
    }
    if (
        !["postgres:", "postgresql:"].includes(url.protocol)
        || !url.hostname
        || !url.username
        || url.pathname === "/"
    ) {
        addError(
            state,
            target,
            variable,
            "INVALID_DATABASE_URL",
            "Must include a PostgreSQL protocol, host, user, and database.",
        );
        return;
    }
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    if (!isLocalHostname(url.hostname) && sslMode === "disable") {
        addError(state, target, variable, "REMOTE_SSL_DISABLED", "Remote PostgreSQL must not disable TLS.");
    } else if (!isLocalHostname(url.hostname) && !sslMode) {
        addWarning(
            state,
            target,
            variable,
            "REMOTE_SSL_MODE_IMPLICIT",
            "Remote PostgreSQL URL does not declare sslmode; confirm the provider enforces TLS.",
        );
    }

    if (!isLocalHostname(url.hostname)) {
        const databaseRole = decodeURIComponent(url.username).split(".", 1)[0];
        if (databaseRole !== "interview_coach_runtime") {
            addError(
                state,
                target,
                variable,
                "UNAPPROVED_DATABASE_ROLE",
                "Remote application processes must connect as interview_coach_runtime, not an owner or administrative role.",
            );
        }
        if (
            target === "vercel-app"
            && url.hostname.toLowerCase().endsWith(".pooler.supabase.com")
            && (url.port || "5432") !== "6543"
        ) {
            addError(
                state,
                target,
                variable,
                "SUPABASE_SESSION_POOLER_UNSAFE",
                "Vercel must use the Supavisor transaction pooler on port 6543; session mode can exhaust the database client ceiling.",
            );
        }
    }
}

function validateHttpsOrigin(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    const value = requireNonempty(env, state, target, variable);
    if (!value) return null;
    try {
        const url = new URL(value);
        if (
            url.protocol !== "https:"
            || url.username
            || url.password
            || url.pathname !== "/"
            || url.search
            || url.hash
            || isLocalHostname(url.hostname)
            || ["0.0.0.0", "::", "[::]"].includes(url.hostname)
        ) {
            throw new Error("invalid");
        }
        return url.origin;
    } catch {
        addError(
            state,
            target,
            variable,
            "INVALID_HTTPS_ORIGIN",
            "Must be one browser-addressable HTTPS origin without a path, query, or fragment.",
        );
        return null;
    }
}

function requireNonempty(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    state.checked.add(variable);
    const value = env[variable]?.trim();
    if (value === "[SENSITIVE]") {
        return handleRedactedValue(state, target, variable);
    }
    if (!value || isPlaceholder(value)) {
        addError(state, target, variable, "REQUIRED", "A non-placeholder value is required.");
        return null;
    }
    return value;
}

function requireExact(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
    expected: string,
) {
    const value = requireNonempty(env, state, target, variable);
    if (value && value !== expected) {
        addError(state, target, variable, "VALUE_MISMATCH", `Must equal ${expected}.`);
    }
}

function requireSecret(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
    minimumBytes: number,
) {
    const value = requireNonempty(env, state, target, variable);
    if (value && Buffer.byteLength(value, "utf8") < minimumBytes) {
        addError(
            state,
            target,
            variable,
            "SECRET_TOO_SHORT",
            `Must contain at least ${minimumBytes} bytes.`,
        );
    }
}

function requireVersion(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    const value = requireNonempty(env, state, target, variable);
    if (value && !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,127}$/.test(value)) {
        addError(
            state,
            target,
            variable,
            "INVALID_VERSION",
            "Must be a stable 2-128 character version identifier.",
        );
    }
}

function requireEmailLike(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    const value = requireNonempty(env, state, target, variable);
    if (value && !/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/.test(value)) {
        addError(state, target, variable, "INVALID_EMAIL", "Must contain a valid email address.");
    }
}

function requireInteger(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
    minimum: number,
    maximum: number,
) {
    const value = requireNonempty(env, state, target, variable);
    if (!value) return;
    validateIntegerValue(value, state, target, variable, minimum, maximum);
}

function validateOptionalInteger(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
    minimum: number,
    maximum: number,
) {
    const value = readOptionalValue(env, state, target, variable);
    if (!value) return;
    validateIntegerValue(value, state, target, variable, minimum, maximum);
}

function validateIntegerValue(
    value: string,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
    minimum: number,
    maximum: number,
) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
        addError(
            state,
            target,
            variable,
            "INVALID_INTEGER",
            `Must be an integer from ${minimum} through ${maximum}.`,
        );
    }
}

function requirePositiveNumber(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    const value = requireNonempty(env, state, target, variable);
    if (!value) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        addError(state, target, variable, "INVALID_NUMBER", "Must be a positive number.");
    }
}

function requireBoolean(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    const value = requireNonempty(env, state, target, variable);
    if (value && !["true", "false"].includes(value.toLowerCase())) {
        addError(state, target, variable, "INVALID_BOOLEAN", "Must equal true or false.");
    }
}

function validateOptionalBoolean(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    const value = readOptionalValue(env, state, target, variable);
    if (value && !["true", "false"].includes(value.toLowerCase())) {
        addError(state, target, variable, "INVALID_BOOLEAN", "Must equal true or false.");
    }
}

function validateOptionalEnum(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
    allowed: readonly string[],
) {
    const value = readOptionalValue(env, state, target, variable)?.toLowerCase();
    if (value && !allowed.includes(value)) {
        addError(state, target, variable, "INVALID_OPTION", `Must be one of: ${allowed.join(", ")}.`);
    }
}

function requireWorkerId(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    const value = requireNonempty(env, state, target, variable);
    if (value && !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{2,119}$/.test(value)) {
        addError(
            state,
            target,
            variable,
            "INVALID_WORKER_ID",
            "Must be a 3-120 character stable worker identifier.",
        );
    }
}

function requireAbsent(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    state.checked.add(variable);
    if (env[variable]?.trim()) {
        addError(state, target, variable, "LOCAL_ONLY_VALUE_PRESENT", "Must be unset in deployed configuration.");
    }
}

function requireFalseOrAbsent(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    const value = readOptionalValue(env, state, target, variable)?.toLowerCase();
    if (value && value !== "false") {
        addError(state, target, variable, "LOCAL_ONLY_MODE_ENABLED", "Must be false or unset.");
    }
}

function readOptionalValue(
    env: Environment,
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    state.checked.add(variable);
    const value = env[variable]?.trim();
    if (value === "[SENSITIVE]") {
        return handleRedactedValue(state, target, variable);
    }
    return value || null;
}

function handleRedactedValue(
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
) {
    state.redacted.add(variable);
    if (!state.allowRedactedValues) {
        addError(
            state,
            target,
            variable,
            "REDACTED_VALUE",
            "The value is masked in this snapshot; run the strict check where real values are available.",
        );
    }
    return null;
}

function addError(
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
    code: string,
    message: string,
) {
    addFinding(state.errors, { target, variable, code, message });
}

function addWarning(
    state: MutableValidation,
    target: DeploymentEnvTarget,
    variable: string,
    code: string,
    message: string,
) {
    addFinding(state.warnings, { target, variable, code, message });
}

function addFinding(findings: DeploymentEnvFinding[], finding: DeploymentEnvFinding) {
    if (!findings.some((current) => (
        current.target === finding.target
        && current.variable === finding.variable
        && current.code === finding.code
    ))) {
        findings.push(finding);
    }
}

function normalizeTargets(targets: readonly DeploymentEnvTarget[] | undefined) {
    return Array.from(new Set(targets?.length ? targets : ["vercel-app"])) as DeploymentEnvTarget[];
}

function parseEnvValue(value: string) {
    if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
        return value
            .slice(1, -1)
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, "\"")
            .replace(/\\\\/g, "\\");
    }
    if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1);
    }
    return value;
}

function isPlaceholder(value: string) {
    const normalized = value.trim().toLowerCase();
    return (
        /^<[^>]+>$/.test(normalized)
        || ["todo", "tbd", "change-me", "changeme", "replace-me", "example"].includes(normalized)
    );
}

function isLocalHostname(hostname: string) {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

type CliOptions = {
    targets: DeploymentEnvTarget[];
    envFile: string | null;
    allowRedactedValues: boolean;
    help: boolean;
};

function parseCliOptions(args: string[]): CliOptions {
    const options: CliOptions = {
        targets: [],
        envFile: null,
        allowRedactedValues: false,
        help: false,
    };
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--help" || argument === "-h") {
            options.help = true;
            continue;
        }
        if (argument === "--target") {
            addCliTarget(options.targets, args[++index]);
            continue;
        }
        if (argument.startsWith("--target=")) {
            addCliTarget(options.targets, argument.slice("--target=".length));
            continue;
        }
        if (argument === "--settings-file") {
            options.envFile = requireCliValue("--settings-file", args[++index]);
            continue;
        }
        if (argument === "--allow-redacted") {
            options.allowRedactedValues = true;
            continue;
        }
        if (argument.startsWith("--settings-file=")) {
            options.envFile = requireCliValue("--settings-file", argument.slice("--settings-file=".length));
            continue;
        }
        throw new Error(`Unknown argument "${argument}".`);
    }
    if (options.targets.length === 0) options.targets.push("vercel-app");
    return options;
}

function addCliTarget(targets: DeploymentEnvTarget[], value: string | undefined) {
    const candidate = requireCliValue("--target", value);
    if (candidate === "all") {
        targets.push(...DEPLOYMENT_ENV_TARGETS);
        return;
    }
    if (!DEPLOYMENT_ENV_TARGETS.includes(candidate as DeploymentEnvTarget)) {
        throw new Error(`Unsupported deployment environment target "${candidate}".`);
    }
    targets.push(candidate as DeploymentEnvTarget);
}

function requireCliValue(argument: string, value: string | undefined) {
    const candidate = value?.trim();
    if (!candidate) throw new Error(`${argument} requires a value.`);
    return candidate;
}

async function main() {
    const options = parseCliOptions(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }
    const fileEnvironment = options.envFile
        ? parseEnvFileContents(await readFile(resolve(process.cwd(), options.envFile), "utf8"))
        : {};
    const result = validateDeploymentEnvironment({
        env: { ...process.env, ...fileEnvironment },
        targets: options.targets,
        allowRedactedValues: options.allowRedactedValues,
    });

    console.log(`Deployment environment targets: ${result.targets.join(", ")}`);
    if (result.redactedVariables.length > 0) {
        console.log(
            `Snapshot contains ${result.redactedVariables.length} Vercel-masked sensitive values; `
            + "presence was checked, but strict value validation requires the real deployment environment.",
        );
    }
    if (result.warnings.length > 0) {
        console.log("Warnings:");
        for (const finding of result.warnings) console.log(formatFinding(finding));
    }
    if (!result.ok) {
        console.error("Deployment environment preflight failed:");
        for (const finding of result.errors) console.error(formatFinding(finding));
        process.exitCode = 1;
        return;
    }
    console.log(`Deployment environment preflight passed (${result.checkedVariables.length} variables checked).`);
}

function formatFinding(finding: DeploymentEnvFinding) {
    return `- [${finding.target}] ${finding.variable} (${finding.code}): ${finding.message}`;
}

function printHelp() {
    console.log(`Check Interview Coach deployment environment configuration without printing values.

Usage:
  npm run env:check
  npm run env:check:azure-staging
  npm run env:check:vercel
  npm run env:check:host-launch
  npm run env:check:ai-eval-worker
  npm run env:check:ai-eval-retention
  npx tsx scripts/check-deployment-env.ts --target all --settings-file .env.all-production.local

Targets:
  vercel-app        Candidate, recruiter, and invited-candidate web application.
  host-launch       TalentArbor signed launch and MSSQL context add-on.
  ai-eval-worker    Separate credentialed scenario worker service.
  ai-eval-retention Separate scheduled scenario-retention process.

The Azure staging command validates the web app and host-launch targets together
from the ignored .env.azure-staging.local operator snapshot. The Vercel snapshot
command allows Vercel's [SENSITIVE] markers and therefore
checks presence only for masked values. The strict default command validates
real values inherited from the current process. An explicit env file overrides
variables inherited from the current shell.
`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}

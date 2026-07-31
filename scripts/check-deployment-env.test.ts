import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
    AZURE_STAGING_ENV_TARGETS,
    parseEnvFileContents,
    validateDeploymentEnvironment,
    type DeploymentEnvTarget,
} from "./check-deployment-env";

const validVercelEnvironment = {
    DATABASE_URL: "postgresql://interview_coach_runtime:secret@db.example.com:5432/interview_coach?sslmode=require",
    NEXT_PUBLIC_APP_URL: "https://interviewcoach.example.com",
    CANDIDATE_ACCOUNT_PUBLIC_ORIGIN: "https://interviewcoach.example.com",
    ENCRYPTION_SECRET: "0123456789abcdef0123456789abcdef",
    GEMINI_API_KEY: "provider-key",
    AUTH_COOKIE_NAME: "ic_app_session",
    CANDIDATE_ACCOUNT_EMAIL_PROVIDER: "smtp",
    RECRUITER_INVITATION_DELIVERY_PROVIDER: "smtp",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "587",
    SMTP_USERNAME: "interview-coach@example.com",
    SMTP_PASSWORD: "smtp-secret",
    SMTP_FROM_EMAIL: "Interview Coach <interview-coach@example.com>",
    CANDIDATE_ACCOUNT_FROM_EMAIL: "TalentArbor Interview Coach <interview-coach@example.com>",
    APP_SESSION_TTL_SECONDS: "28800",
    RECRUITER_INVITE_TOKEN_TTL_SECONDS: "1209600",
    INVITED_PRACTICE_ACCESS_TTL_SECONDS: "604800",
    CANDIDATE_EMAIL_VERIFICATION_TTL_SECONDS: "86400",
    CANDIDATE_PASSWORD_RESET_TTL_SECONDS: "1800",
    CANDIDATE_TERMS_VERSION: "terms-2026-07",
    CANDIDATE_PRIVACY_VERSION: "privacy-2026-07",
    CANDIDATE_COOKIE_VERSION: "cookie-2026-07",
    CANDIDATE_RESPONSIBLE_AI_VERSION: "responsible-ai-2026-07",
    CANDIDATE_CONTACT_AUTHORIZATION_VERSION: "contact-authorization-2026-07",
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
    CANDIDATE_HOST_LAUNCH_DEV_MODE: "false",
};

describe("deployment environment preflight", () => {
    it("accepts the complete candidate, recruiter, and invited Vercel contract", () => {
        const result = validateDeploymentEnvironment({
            env: validVercelEnvironment,
            targets: ["vercel-app"],
        });

        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.checkedVariables).toContain("CANDIDATE_QUESTION_WORDING_PROFILE");
        expect(result.checkedVariables).toContain("SESSION_VOICE_TRANSCRIPTION_PROFILE");
    });

    it("fails closed on missing values, profile drift, unsafe local controls, and split origins", () => {
        const secret = "do-not-print-this-secret";
        const result = validateDeploymentEnvironment({
            env: {
                ...validVercelEnvironment,
                SMTP_PASSWORD: secret,
                CANDIDATE_QUESTION_WORDING_PROFILE: "wrong",
                CANDIDATE_HOST_LAUNCH_DEV_SECRET: "local-secret",
                SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED: "true",
                CANDIDATE_ACCOUNT_PUBLIC_ORIGIN: "https://accounts.example.com",
                CANDIDATE_PRIVACY_VERSION: "",
            },
            targets: ["vercel-app"],
        });

        expect(result.ok).toBe(false);
        expect(result.errors.map((finding) => [finding.variable, finding.code])).toEqual(expect.arrayContaining([
            ["CANDIDATE_QUESTION_WORDING_PROFILE", "VALUE_MISMATCH"],
            ["CANDIDATE_HOST_LAUNCH_DEV_SECRET", "LOCAL_ONLY_VALUE_PRESENT"],
            ["SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED", "LOCAL_ONLY_MODE_ENABLED"],
            ["CANDIDATE_ACCOUNT_PUBLIC_ORIGIN", "ORIGIN_MISMATCH"],
            ["CANDIDATE_PRIVACY_VERSION", "REQUIRED"],
        ]));
        expect(JSON.stringify(result)).not.toContain(secret);
    });

    it("rejects an owner or administrative database role for remote application targets", () => {
        const result = validateDeploymentEnvironment({
            env: {
                ...validVercelEnvironment,
                DATABASE_URL: "postgresql://postgres.projectref:secret@pooler.supabase.com:5432/postgres?sslmode=require",
            },
            targets: ["vercel-app"],
        });

        expect(result.ok).toBe(false);
        expect(result.errors).toContainEqual(expect.objectContaining({
            target: "vercel-app",
            variable: "DATABASE_URL",
            code: "UNAPPROVED_DATABASE_ROLE",
        }));
    });

    it("accepts the Supavisor username form for the approved runtime role", () => {
        const result = validateDeploymentEnvironment({
            env: {
                ...validVercelEnvironment,
                DATABASE_URL: "postgresql://interview_coach_runtime.projectref:secret@pooler.supabase.com:6543/postgres?sslmode=require",
            },
            targets: ["vercel-app"],
        });

        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it("treats Vercel sensitive markers as presence-only in snapshot mode", () => {
        const masked = Object.fromEntries(
            Object.keys(validVercelEnvironment).map((variable) => [variable, "[SENSITIVE]"]),
        );
        const snapshot = validateDeploymentEnvironment({
            env: masked,
            targets: ["vercel-app"],
            allowRedactedValues: true,
        });
        const strict = validateDeploymentEnvironment({
            env: masked,
            targets: ["vercel-app"],
        });

        expect(snapshot.ok).toBe(true);
        expect(snapshot.redactedVariables.length).toBeGreaterThan(30);
        expect(strict.ok).toBe(false);
        expect(strict.errors.every((finding) => finding.code === "REDACTED_VALUE")).toBe(true);
    });

    it("validates the future host-launch boundary independently", () => {
        const result = validateDeploymentEnvironment({
            env: {
                DATABASE_URL: validVercelEnvironment.DATABASE_URL,
                CANDIDATE_HOST_LAUNCH_DEV_MODE: "false",
                CANDIDATE_HOST_LAUNCH_SECRET: "0123456789abcdef0123456789abcdef",
                CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER: "talentarbor",
                CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE: "talentarbor",
                CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS: "30",
                CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS: "120",
                CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS: "604800",
                CANDIDATE_HOST_LAUNCH_TA_SQL_SERVER: "sql.example.internal",
                CANDIDATE_HOST_LAUNCH_TA_SQL_PORT: "1433",
                CANDIDATE_HOST_LAUNCH_TA_SQL_DATABASE: "TalentArborStaging",
                CANDIDATE_HOST_LAUNCH_TA_SQL_USER: "interview_coach_reader",
                CANDIDATE_HOST_LAUNCH_TA_SQL_PASSWORD: "sql-secret",
                CANDIDATE_HOST_LAUNCH_TA_SQL_ENCRYPT: "true",
                CANDIDATE_HOST_LAUNCH_TA_SQL_TRUST_SERVER_CERTIFICATE: "false",
                CANDIDATE_HOST_LAUNCH_TA_SQL_CONNECT_TIMEOUT_MS: "5000",
                CANDIDATE_HOST_LAUNCH_TA_SQL_REQUEST_TIMEOUT_MS: "8000",
                CANDIDATE_HOST_LAUNCH_TA_SQL_POOL_MAX: "4",
            },
            targets: ["host-launch"],
        });

        expect(result.ok).toBe(true);
        expect(result.targets).toEqual(["host-launch"]);
    });

    it("validates the Azure staging web app and host-launch boundaries together", () => {
        const result = validateDeploymentEnvironment({
            env: {
                ...validVercelEnvironment,
                CANDIDATE_HOST_LAUNCH_SECRET: "0123456789abcdef0123456789abcdef",
                CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER: "talentarbor",
                CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE: "talentarbor",
                CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS: "30",
                CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS: "120",
                CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS: "604800",
                CANDIDATE_HOST_LAUNCH_TA_SQL_SERVER: "sql.example.internal",
                CANDIDATE_HOST_LAUNCH_TA_SQL_PORT: "1433",
                CANDIDATE_HOST_LAUNCH_TA_SQL_DATABASE: "TalentArborStaging",
                CANDIDATE_HOST_LAUNCH_TA_SQL_USER: "interview_coach_reader",
                CANDIDATE_HOST_LAUNCH_TA_SQL_PASSWORD: "sql-secret",
                CANDIDATE_HOST_LAUNCH_TA_SQL_ENCRYPT: "true",
                CANDIDATE_HOST_LAUNCH_TA_SQL_TRUST_SERVER_CERTIFICATE: "false",
                CANDIDATE_HOST_LAUNCH_TA_SQL_CONNECT_TIMEOUT_MS: "5000",
                CANDIDATE_HOST_LAUNCH_TA_SQL_REQUEST_TIMEOUT_MS: "8000",
                CANDIDATE_HOST_LAUNCH_TA_SQL_POOL_MAX: "4",
            },
            targets: AZURE_STAGING_ENV_TARGETS,
        });

        expect(result.ok).toBe(true);
        expect(result.targets).toEqual(AZURE_STAGING_ENV_TARGETS);
    });

    it("validates worker and retention configuration as separate deployable processes", () => {
        const env = {
            DATABASE_URL: validVercelEnvironment.DATABASE_URL,
            GEMINI_API_KEY: "provider-key",
            CANDIDATE_ANSWER_ANALYSIS_PROVIDER: "google_genai",
            CANDIDATE_ANSWER_ANALYSIS_PROFILE: "google_gemini_2_5_flash_v1",
            CANDIDATE_COACH_UPDATE_PROVIDER: "google_genai",
            CANDIDATE_COACH_UPDATE_PROFILE: "google_gemini_2_5_flash_coach_update_v4",
            AI_EVAL_SCENARIO_LIVE_ENABLED: "true",
            AI_EVAL_SCENARIO_INPUT_USD_PER_MILLION_TOKENS: "0.15",
            AI_EVAL_SCENARIO_OUTPUT_USD_PER_MILLION_TOKENS: "0.60",
            AI_EVAL_SCENARIO_MAX_ESTIMATED_COST_USD: "10",
            AI_EVAL_SCENARIO_MAX_CALLS: "1000",
            AI_EVAL_SCENARIO_LIVE_CONCURRENCY: "2",
            AI_EVAL_SCENARIO_WORKER_ID: "staging:ai-eval:01",
            AI_EVAL_SCENARIO_WORKER_POLL_INTERVAL_MS: "2000",
            AI_EVAL_SCENARIO_WORKER_ERROR_BACKOFF_MS: "5000",
            AI_EVAL_SCENARIO_WORKER_MAX_CONSECUTIVE_ERRORS: "5",
            AI_EVAL_SCENARIO_WORKER_HEALTH_HOST: "0.0.0.0",
            AI_EVAL_SCENARIO_WORKER_HEALTH_PORT: "8080",
            AI_EVAL_SCENARIO_RETENTION_WORKER_ID: "staging:ai-eval-retention:01",
        };
        const targets: DeploymentEnvTarget[] = ["ai-eval-worker", "ai-eval-retention"];

        const result = validateDeploymentEnvironment({ env, targets });

        expect(result.ok).toBe(true);
        expect(result.targets).toEqual(targets);
    });

    it("parses explicit env files without interpolation or accidental comment stripping", () => {
        expect(parseEnvFileContents(`
# deployment
export DATABASE_URL='postgresql://app:p@db.example.com/app?sslmode=require'
SMTP_FROM_EMAIL=Interview Coach <coach@example.com>
QUOTED="line\\nvalue"
`)).toEqual({
            DATABASE_URL: "postgresql://app:p@db.example.com/app?sslmode=require",
            SMTP_FROM_EMAIL: "Interview Coach <coach@example.com>",
            QUOTED: "line\nvalue",
        });
    });

    it("keeps the committed manifest complete and scoped to Azure staging", () => {
        const manifest = parseEnvFileContents(
            readFileSync(resolve(process.cwd(), ".env.example"), "utf8"),
        );
        const requiredVariables = new Set<string>();

        for (const target of AZURE_STAGING_ENV_TARGETS) {
            const result = validateDeploymentEnvironment({ env: {}, targets: [target] });
            for (const finding of result.errors) {
                if (finding.code === "REQUIRED") requiredVariables.add(finding.variable);
            }
        }

        expect(
            Array.from(requiredVariables).filter((variable) => !(variable in manifest)),
        ).toEqual([]);
        expect(manifest).not.toHaveProperty("APP_AUTH_BACKEND");
        expect(manifest).not.toHaveProperty("SESSION_REPOSITORY_BACKEND");
        expect(manifest).not.toHaveProperty("CANDIDATE_AUTH_MODE");
        expect(manifest).not.toHaveProperty("NEXT_PUBLIC_BASE_URL");
        expect(manifest).not.toHaveProperty("DATABASE_MIGRATION_URL");
        expect(manifest).not.toHaveProperty("DATABASE_RUNTIME_PASSWORD");
        expect(manifest).not.toHaveProperty("ONET_API_KEY");
        expect(manifest).not.toHaveProperty("AI_EVAL_SCENARIO_LIVE_ENABLED");
        expect(manifest).not.toHaveProperty("CANDIDATE_HOST_LAUNCH_DEV_SECRET");
    });
});

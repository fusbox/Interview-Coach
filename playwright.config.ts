import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: "list",
    use: {
        baseURL,
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== "false" && !process.env.CI,
        env: {
            NODE_ENV: "development",
            E2E_TEST_MODE: "true",
            NEXT_PUBLIC_E2E_TEST_MODE: "true",
            NEXT_PUBLIC_BASE_URL: baseURL,
            DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:interviewcoach-local-smoke-password@127.0.0.1:5434/interviewcoach_smoke",
            CANDIDATE_DATA_BACKEND: process.env.CANDIDATE_DATA_BACKEND ?? "postgres",
            CANDIDATE_AUTH_MODE: process.env.CANDIDATE_AUTH_MODE ?? "external",
            CANDIDATE_DEV_EMAIL: process.env.CANDIDATE_DEV_EMAIL ?? "candidate-dev-primary@talentarbor.local",
            CANDIDATE_DEV_ISSUER: process.env.CANDIDATE_DEV_ISSUER ?? "interview-coach-local",
            CANDIDATE_DEV_SUBJECT: process.env.CANDIDATE_DEV_SUBJECT ?? "candidate-dev-primary@talentarbor.local",
            CANDIDATE_DEV_DISPLAY_NAME: process.env.CANDIDATE_DEV_DISPLAY_NAME ?? "Dev Candidate Primary",
            CANDIDATE_MOCK_EMAIL: process.env.CANDIDATE_MOCK_EMAIL ?? "candidate-dev-primary@talentarbor.local",
            CANDIDATE_MOCK_DISPLAY_NAME: process.env.CANDIDATE_MOCK_DISPLAY_NAME ?? "Dev Candidate Primary",
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
            NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
        },
    },
});

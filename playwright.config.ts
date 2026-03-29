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
        reuseExistingServer: !process.env.CI,
        env: {
            NODE_ENV: "development",
            E2E_TEST_MODE: "true",
            NEXT_PUBLIC_E2E_TEST_MODE: "true",
            NEXT_PUBLIC_BASE_URL: baseURL,
            NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
        },
    },
});

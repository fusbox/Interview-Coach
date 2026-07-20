import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
    testDir: "./e2e",
    outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? "test-results",
    fullyParallel: false,
    retries: 0,
    reporter: "list",
    use: {
        baseURL,
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "production-chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});

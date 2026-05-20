import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    retries: 0,
    reporter: "list",
    use: {
        baseURL,
        trace: "on-first-retry",
        permissions: ["microphone"],
        launchOptions: {
            args: [
                "--use-fake-device-for-media-stream",
                "--use-fake-ui-for-media-stream",
            ],
        },
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});

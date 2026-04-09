import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { canShowReplayTourButton, showDemoTools } from "./feature-flags";

describe("feature flags", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_SHOW_DEMO_TOOLS", "false");
        vi.stubEnv("NODE_ENV", "production");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("keeps demo tools disabled in production by default", () => {
        expect(showDemoTools()).toBe(false);
    });

    it("shows the replay tour button for the internal override email", () => {
        expect(canShowReplayTourButton("fu@rangam.com")).toBe(true);
        expect(canShowReplayTourButton("FU@RANGAM.COM")).toBe(true);
    });

    it("does not show the replay tour button for other users in production", () => {
        expect(canShowReplayTourButton("someone@example.com")).toBe(false);
        expect(canShowReplayTourButton()).toBe(false);
    });
});

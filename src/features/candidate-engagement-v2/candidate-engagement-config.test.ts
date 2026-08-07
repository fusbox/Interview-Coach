import { describe, expect, it } from "vitest";

import {
    isCandidateEngagementInspectorEnabled,
    isCandidateEngagementReportingEnabled,
} from "./candidate-engagement-config";

describe("candidate engagement configuration", () => {
    it("defaults collection on locally and off in production", () => {
        expect(isCandidateEngagementReportingEnabled({ NODE_ENV: "development" })).toBe(true);
        expect(isCandidateEngagementReportingEnabled({ NODE_ENV: "production" })).toBe(false);
    });

    it("honors an explicit collection decision", () => {
        expect(isCandidateEngagementReportingEnabled({
            NODE_ENV: "production",
            CANDIDATE_ENGAGEMENT_REPORTING_ENABLED: "true",
        })).toBe(true);
        expect(isCandidateEngagementReportingEnabled({
            NODE_ENV: "development",
            CANDIDATE_ENGAGEMENT_REPORTING_ENABLED: "false",
        })).toBe(false);
    });

    it("never exposes the inspector in production", () => {
        expect(isCandidateEngagementInspectorEnabled({ NODE_ENV: "development" })).toBe(true);
        expect(isCandidateEngagementInspectorEnabled({ NODE_ENV: "production" })).toBe(false);
    });
});

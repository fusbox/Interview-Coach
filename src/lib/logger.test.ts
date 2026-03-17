import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "./logger";
import { createServerLogger } from "./server/server-logger";

describe("Logger", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("serializes structured server log fields at the top level", () => {
        const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

        Logger.info("Invite created", {
            correlationId: "corr-1",
            route: "/api/recruiter/invites",
            actorType: "recruiter",
            actorId: "user-1",
            sessionId: "session-1",
            errorCode: "NONE",
            candidateCount: 2
        }, "RecruiterInvitesAPI");

        const [serialized] = spy.mock.calls[0];
        const entry = JSON.parse(serialized as string);

        expect(entry).toMatchObject({
            message: "Invite created",
            context: "RecruiterInvitesAPI",
            correlationId: "corr-1",
            route: "/api/recruiter/invites",
            actorType: "recruiter",
            actorId: "user-1",
            sessionId: "session-1",
            errorCode: "NONE"
        });
        expect(entry.data).toMatchObject({
            candidateCount: 2
        });
        expect(entry.timestamp).toBeDefined();
    });

    it("normalizes Error objects in structured payloads", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const error = new Error("boom");

        Logger.error("Route failed", {
            correlationId: "corr-2",
            error
        }, "AnalysisAPI");

        const [serialized] = spy.mock.calls[0];
        const entry = JSON.parse(serialized as string);

        expect(entry.correlationId).toBe("corr-2");
        expect(entry.data.error).toMatchObject({
            name: "Error",
            message: "boom"
        });
    });

    it("merges request-scoped server logger fields", () => {
        const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const logger = createServerLogger("InviteAPI", {
            correlationId: "corr-3",
            route: "/api/invite/send",
            actorType: "recruiter"
        });

        logger.warn("Rate limit exceeded", {
            actorId: "user-2",
            ip: "127.0.0.1",
            errorCode: "RATE_LIMITED"
        });

        const [serialized] = spy.mock.calls[0];
        const entry = JSON.parse(serialized as string);

        expect(entry).toMatchObject({
            context: "InviteAPI",
            correlationId: "corr-3",
            route: "/api/invite/send",
            actorType: "recruiter",
            actorId: "user-2",
            ip: "127.0.0.1",
            errorCode: "RATE_LIMITED"
        });
    });
});

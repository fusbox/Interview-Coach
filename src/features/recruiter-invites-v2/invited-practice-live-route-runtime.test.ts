import { describe, expect, it } from "vitest";

import { readInvitedPracticeAccessCookie } from "./invited-practice-live-route-runtime";

describe("invited live-route cookie parsing", () => {
    it("reads only the invited access cookie", () => {
        expect(readInvitedPracticeAccessCookie(
            "ic_app_session=recruiter; ic_invited_access=invite-session; ic_candidate_launch_session=candidate",
        )).toBe("invite-session");
        expect(readInvitedPracticeAccessCookie("ic_app_session=recruiter")).toBeNull();
    });

    it("treats malformed percent encoding as missing access", () => {
        expect(readInvitedPracticeAccessCookie("ic_invited_access=%E0%A4%A"))
            .toBeNull();
    });
});

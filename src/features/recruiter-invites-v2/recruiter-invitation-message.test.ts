import { describe, expect, it } from "vitest";

import {
    createRecruiterInvitationCopyMessage,
    createRecruiterInvitationMessage,
} from "./recruiter-invitation-message";

describe("recruiter invitation message", () => {
    it("uses the same approved factual copy for email and clipboard handoff", () => {
        const input = {
            firstName: "Irma",
            targetRole: "Quality Inspector",
            inviteLink: "https://interviewcoach.example/s/personal-token",
            recruiterName: "Dev Recruiter",
        };
        const message = createRecruiterInvitationMessage(input);

        expect(message.text).toBe(createRecruiterInvitationCopyMessage(input));
        expect(message.text).toContain("Please do not forward it.");
        expect(message.text).toContain("does not make hiring decisions");
        expect(message.text).not.toMatch(/delivered|private|recruiter can see/i);
        expect(message.html).toContain("https://interviewcoach.example/s/personal-token");
    });

    it("escapes candidate-controlled values in HTML and removes line breaks from headers", () => {
        const message = createRecruiterInvitationMessage({
            firstName: '<Irma & "team">',
            targetRole: "Inspector\r\nBcc: attacker@example.com",
            inviteLink: "https://interviewcoach.example/s/token?a=1&b=2",
            recruiterName: "A <Recruiter>",
        });

        expect(message.subject).not.toContain("\n");
        expect(message.html).toContain("&lt;Irma &amp; &quot;team&quot;&gt;");
        expect(message.html).toContain("A &lt;Recruiter&gt;");
        expect(message.html).toContain("a=1&amp;b=2");
        expect(message.html).not.toContain("<Irma");
    });
});

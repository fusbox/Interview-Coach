import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StepPreviewCombined } from "./StepPreviewCombined";

vi.mock("@/components/patterns/InviteEmailPreviewModal", () => ({
    InviteEmailPreviewModal: ({
        isOpen,
        onSend,
        errorMessage
    }: {
        isOpen: boolean;
        onSend: () => void;
        errorMessage?: string | null;
    }) => isOpen ? (
        <div>
            <button onClick={onSend}>Send</button>
            {errorMessage ? <div role="alert">{errorMessage}</div> : null}
        </div>
    ) : null
}));

describe("StepPreviewCombined", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("surfaces send failures instead of failing silently", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ message: "Authentication required" })
        });
        vi.stubGlobal("fetch", fetchMock);

        render(
            <StepPreviewCombined
                details={{ role: "QA Engineer", jd: "", firstName: "", lastName: "", candidateEmail: "", reqId: "REQ-1" }}
                star={[]}
                perma={[]}
                technical={[]}
                candidates={[{ id: "c1", firstName: "Pat", lastName: "Lee", email: "pat@example.com" }]}
                onBack={() => {}}
                onHandleCreate={async () => {}}
                isLoading={false}
                isGenerated={true}
                results={[{ id: "s1", firstName: "Pat", lastName: "Lee", email: "pat@example.com", link: "https://example.com/s/token" }]}
                failures={[]}
                summary={null}
                error={null}
                recruiterProfile={{ name: "Recruiter", email: "recruiter@example.com", phone: "", title: "Lead", company: "Company" }}
                onNewInvite={() => {}}
                onDashboard={() => {}}
            />
        );

        fireEvent.click(screen.getByText("Send"));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent("Authentication required");
        });
    });
});

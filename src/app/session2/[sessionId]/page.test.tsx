import { redirect } from "next/navigation";
import { expect, it, vi } from "vitest";
import Session2Page from "./page";

vi.mock("next/navigation", () => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`NEXT_REDIRECT:${href}`);
    }),
}));

it("redirects the old V2 session route to the candidate namespace", async () => {
    await expect(Session2Page({ params: Promise.resolve({ sessionId: "session v2 1" }) })).rejects.toThrow(
        "NEXT_REDIRECT:/candidate/session/session%20v2%201",
    );
    expect(redirect).toHaveBeenCalledWith("/candidate/session/session%20v2%201");
});

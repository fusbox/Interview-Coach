import { redirect } from "next/navigation";
import { expect, it, vi } from "vitest";
import Dashboard2Page from "./page";

vi.mock("next/navigation", () => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`NEXT_REDIRECT:${href}`);
    }),
}));

it("redirects the old V2 dashboard route to the candidate namespace", () => {
    expect(() => Dashboard2Page()).toThrow("NEXT_REDIRECT:/candidate/dashboard");
    expect(redirect).toHaveBeenCalledWith("/candidate/dashboard");
});

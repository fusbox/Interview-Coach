import { redirect } from "next/navigation";
import { expect, it, vi } from "vitest";
import Practice2Page from "./page";

vi.mock("next/navigation", () => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`NEXT_REDIRECT:${href}`);
    }),
}));

it("redirects the old V2 setup route to the candidate namespace", () => {
    expect(() => Practice2Page()).toThrow("NEXT_REDIRECT:/candidate/setup");
    expect(redirect).toHaveBeenCalledWith("/candidate/setup");
});

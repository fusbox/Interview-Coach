import { render, screen } from "@testing-library/react";
import { createElement, type ComponentProps, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

vi.mock("next/image", () => ({
    default: ({ priority, unoptimized, ...props }: ComponentProps<"img"> & {
        priority?: boolean;
        unoptimized?: boolean;
    }) => {
        void priority;
        void unoptimized;
        return createElement("img", props);
    },
}));

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

describe("candidate public home page", () => {
    it("routes candidate CTAs through the TalentArbor login-start boundary", () => {
        render(<Home />);

        for (const link of screen.getAllByRole("link", { name: /start practicing/i })) {
            expect(link).toHaveAttribute("href", "/auth/talentarbor/start?next=/practice");
        }
        expect(screen.getAllByRole("link", { name: /review dashboard/i })[0]).toHaveAttribute(
            "href",
            "/auth/talentarbor/start?next=/dashboard"
        );
    });

    it("does not expose recruiter-owned route targets from the public candidate funnel", () => {
        render(<Home />);

        const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));

        expect(hrefs).not.toContain("/recruiter");
        expect(hrefs).not.toContain("/recruiter/create");
        expect(hrefs).not.toContain("/login");
    });
});

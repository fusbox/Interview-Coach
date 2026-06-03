import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

import { CandidateShell } from "./CandidateShell";

vi.mock("next/image", () => ({
    default: ({ fill, priority, unoptimized, ...props }: React.ComponentProps<"img"> & {
        fill?: boolean;
        priority?: boolean;
        unoptimized?: boolean;
    }) => {
        void fill;
        void priority;
        void unoptimized;
        return createElement("img", props);
    },
}));

vi.mock("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

describe("CandidateShell", () => {
    it("renders candidate disclosure copy and the company footer placeholder for app pages", () => {
        render(
            <CandidateShell>
                <section>Candidate app content</section>
            </CandidateShell>,
        );

        expect(screen.getByText(/interview coach uses ai for practice coaching/i)).toBeInTheDocument();
        expect(screen.getByText(/protected by app security and access controls/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/company footer placeholder/i)).toBeInTheDocument();
    });
});

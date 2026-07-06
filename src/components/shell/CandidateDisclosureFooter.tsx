import type React from "react";

type CandidateDisclosureFooterProps = {
    children?: React.ReactNode;
};

const defaultDisclosure =
    "Interview Coach uses AI for practice coaching. Practice data is protected by app security and access controls, and is not used to make hiring decisions.";

export function CandidateDisclosureFooter({ children }: CandidateDisclosureFooterProps) {
    return (
        <footer className="w-full border-t border-border/70 px-6 py-8 text-center text-sm leading-6 text-text-secondary md:px-10">
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5">
                <p>{children ?? defaultDisclosure}</p>
                <div
                    aria-label="Company footer placeholder"
                    data-integration-note="Integration team: place the approved company footer here."
                    className="min-h-10 w-full"
                />
            </div>
        </footer>
    );
}

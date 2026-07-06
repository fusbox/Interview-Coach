import type { ReactNode } from "react";
import { CandidateV2Surface, candidateV2Classes } from "./design-system";

type V2RouteShellProps = {
    title: string;
    description: string;
    children?: ReactNode;
};

export function V2RouteShell({ title, description, children }: V2RouteShellProps) {
    return (
        <main className={candidateV2Classes.page}>
            <CandidateV2Surface title={title} description={description}>
                {children}
            </CandidateV2Surface>
        </main>
    );
}

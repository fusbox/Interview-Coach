import { CandidateV2Surface, candidateV2Classes } from "./design-system";

type V2RouteShellProps = {
    title: string;
    description: string;
};

export function V2RouteShell({ title, description }: V2RouteShellProps) {
    return (
        <main className={candidateV2Classes.page}>
            <CandidateV2Surface title={title} description={description} />
        </main>
    );
}

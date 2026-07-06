import { V2RouteShell } from "@/features/candidate-v2/V2RouteShell";

export default async function Session2Page({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;

    return (
        <V2RouteShell
            title="Practice session V2"
            description={`This route will host the rebuilt shared session runtime for session ${sessionId}.`}
        />
    );
}

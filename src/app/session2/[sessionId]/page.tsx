import { V2Placeholder } from "@/features/candidate-v2/V2Placeholder";

export default async function Session2Page({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;

    return (
        <V2Placeholder
            title="Practice session V2"
            description={`This route will host the rebuilt shared session runtime for session ${sessionId}.`}
        />
    );
}

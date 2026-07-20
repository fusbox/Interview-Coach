import { renderRecruiterSessionTranscriptRoute } from "./RecruiterSessionTranscriptRoute";

export const dynamic = "force-dynamic";

export default async function RecruiterSessionTranscriptPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    return renderRecruiterSessionTranscriptRoute({ params });
}

import { renderAiEvalWorkbenchRoute } from "./AiEvalWorkbenchRoute";

export const dynamic = "force-dynamic";

export default async function AiEvalWorkbenchPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    return renderAiEvalWorkbenchRoute(await searchParams);
}

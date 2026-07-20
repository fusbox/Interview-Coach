import { renderRecruiterInvitationHandoffRoute } from "./RecruiterInvitationHandoffRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RecruiterInvitationHandoffPage({
    params,
}: {
    params: Promise<{ batchId: string }>;
}) {
    return renderRecruiterInvitationHandoffRoute({ params });
}

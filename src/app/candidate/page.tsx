import { redirect } from "next/navigation";
import {
    requireCurrentCandidatePageAccess,
    resolveCandidateEntryDestination,
} from "@/features/candidate-auth-v2/candidate-route-authorization";

export default async function CandidateIndexPage() {
    const { identity, client } = await requireCurrentCandidatePageAccess("/candidate");
    redirect(await resolveCandidateEntryDestination(identity, client));
}

import { getCachedUser } from "@/lib/supabase/server";
import { recordAuthDenial } from "@/lib/server/metrics";

export type CurrentServerUser = NonNullable<Awaited<ReturnType<typeof getCachedUser>>>;

export async function getAuthenticatedRouteUser({
    actorType,
    route,
    denialReason = "missing_authenticated_user",
}: {
    actorType: string;
    route: string;
    denialReason?: string;
}): Promise<CurrentServerUser | null> {
    const user = await getCachedUser();

    if (!user) {
        recordAuthDenial({
            actorType,
            route,
            reason: denialReason,
        });
        return null;
    }

    return user;
}

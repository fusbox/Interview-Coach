import { cookies } from "next/headers";
import type { AppUser } from "./app-user";
import { canAccessRecruiterRoutes } from "./app-user";
import { getUserBySessionToken } from "./app-auth";
import { getAppSessionCookieName } from "./app-session";

export type RecruiterAccess =
    | { kind: "authorized"; user: AppUser }
    | { kind: "missing" }
    | { kind: "forbidden"; user: AppUser };

type CookieReader = {
    get(name: string): { value: string } | undefined;
};

export async function getCurrentRecruiterAccess(dependencies: {
    cookieStore?: CookieReader;
    resolveUser?: (sessionToken: string | undefined) => Promise<AppUser | null>;
} = {}): Promise<RecruiterAccess> {
    const cookieStore = dependencies.cookieStore ?? await cookies();
    const sessionToken = cookieStore.get(getAppSessionCookieName())?.value;
    const user = await (dependencies.resolveUser ?? getUserBySessionToken)(sessionToken);

    if (!user) return { kind: "missing" };
    if (!canAccessRecruiterRoutes(user)) return { kind: "forbidden", user };
    return { kind: "authorized", user };
}

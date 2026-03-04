import { getCachedUser } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCachedUser();

    // Strict Admin Guard
    if (!user || !isAdmin(user)) {
        redirect("/recruiter");
    }

    return (
        <div className="flex-1">
            {children}
        </div>
    );
}

import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { notFound, redirect } from "next/navigation";
import { getCachedUser } from "@/lib/supabase/server";
import { SessionEvalForm } from "../components/SessionEvalForm";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { showDemoTools } from "@/lib/feature-flags";

const sessionRepo = new SupabaseSessionRepository();

export const dynamic = "force-dynamic";

export default async function DevEvalDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Demo-mode gate
    if (!showDemoTools()) {
        redirect("/recruiter");
    }

    const user = await getCachedUser();
    if (!user) redirect("/login");

    const session = await sessionRepo.get(id);
    if (!session) notFound();

    return (
        <div className="space-y-6 mx-auto max-w-4xl">
            <div className="flex items-center gap-3">
                <Link href="/recruiter/dev-eval" className="text-slate-400 transition-colors hover:text-slate-600">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold font-display text-slate-900">
                            {session.candidateName || "Anonymous"} - {session.role}
                        </h1>
                        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-micro text-violet-700">
                            INTERNAL DEV TOOL
                        </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                        {session.questions.length} questions - {Object.keys(session.answers).length} answers - hidden calibration fields shown for internal review only
                    </p>
                </div>
            </div>

            <SessionEvalForm session={session} />
        </div>
    );
}

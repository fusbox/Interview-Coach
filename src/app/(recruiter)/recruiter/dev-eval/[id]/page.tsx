import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { notFound, redirect } from "next/navigation";
import { getCachedUser } from "@/lib/supabase/server";
import { SessionEvalForm } from "../components/SessionEvalForm";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { showDemoTools } from "@/lib/feature-flags";

const sessionRepo = new SupabaseSessionRepository();

export const dynamic = 'force-dynamic';

export default async function DevEvalDetailPage({ params }: { params: { id: string } }) {
    // Demo-mode gate
    if (!showDemoTools()) {
        redirect("/recruiter");
    }

    const user = await getCachedUser();
    if (!user) redirect("/login");

    const session = await sessionRepo.get(params.id);
    if (!session) notFound();

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
                <Link href="/recruiter/dev-eval" className="text-slate-400 hover:text-slate-600 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold font-display text-slate-900">
                            {session.candidateName || 'Anonymous'} — {session.role}
                        </h1>
                        <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-micro">DEV EVAL</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {session.questions.length} questions · {Object.keys(session.answers).length} answers
                    </p>
                </div>
            </div>

            <SessionEvalForm session={session} />
        </div>
    );
}

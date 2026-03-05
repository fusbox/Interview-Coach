import { getRecruiterSessions } from "../actions";
import { getCachedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DevEvalTable } from "./components/DevEvalTable";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { showDemoTools } from "@/lib/feature-flags";

export const dynamic = 'force-dynamic';

export default async function DevEvalPage() {
    // Demo-mode gate
    if (!showDemoTools()) {
        redirect("/recruiter");
    }

    const user = await getCachedUser();
    if (!user) redirect("/login");

    const sessions = await getRecruiterSessions();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/recruiter" className="text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold font-display text-slate-900">Dev Evaluation</h1>
                            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-micro">DEV ONLY</Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">Score sessions, evaluate candidate-facing content quality, and export data for analysis.</p>
                    </div>
                </div>
            </div>

            <DevEvalTable sessions={sessions} />
        </div>
    );
}

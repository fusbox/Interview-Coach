import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, Mail, User, AlertCircle } from "lucide-react";
import Link from "next/link";
import { SupabaseFeedbackRepository } from "@/lib/server/infrastructure/supabase-feedback-repository";
import { cn } from "@/lib/cn";

export const dynamic = 'force-dynamic';

function formatRelativeTime(date: Date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export default async function AdminFeedbackPage() {
    const repo = new SupabaseFeedbackRepository();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let feedback: any[] = [];
    let error: string | null = null;

    try {
        feedback = await repo.listAdminView();
    } catch (e) {
        console.error('Failed to fetch admin feedback', e);
        error = "Failed to load feedback records.";
    }

    const internalFeedback = feedback.filter(f => f.type.startsWith('recruiter_'));
    const externalFeedback = feedback.filter(f => !f.type.startsWith('recruiter_'));

    const getIconForType = (type: string) => {
        if (type.startsWith('recruiter_')) return <Mail className="w-4 h-4 text-blue-500" />;
        return <User className="w-4 h-4 text-emerald-500" />;
    };

    const getLabelForType = (type: string) => {
        switch (type) {
            case 'recruiter_friction_invite': return 'Invite Ease';
            case 'recruiter_preparation_lift': return 'Prep Lift';
            case 'baseline_confidence': return 'Baseline Conf';
            case 'helpfulness_delivery': return 'Delivery Help';
            case 'helpfulness_content': return 'Content Help';
            case 'session_completion_confidence_delta': return 'Final Prep';
            case 'session_completion_psychological_safety': return 'Safety';
            case 'session_completion_repeat_intent': return 'Repeat Intent';
            default: return type.replace(/_/g, ' ');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Admin Portal</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display">User Feedback</h1>
                    <p className="text-slate-500 mt-1">Aggregated insights from candidates and recruiters.</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/recruiter">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border p-6 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Signals</p>
                    <p className="text-3xl font-black text-slate-900">{feedback.length}</p>
                </div>
                <div className="bg-white rounded-2xl border p-6 shadow-sm">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Internal (Recruiter)</p>
                    <p className="text-3xl font-black text-blue-600">{internalFeedback.length}</p>
                </div>
                <div className="bg-white rounded-2xl border p-6 shadow-sm">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">External (Candidate)</p>
                    <p className="text-3xl font-black text-emerald-600">{externalFeedback.length}</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-6 border-b">
                    <h3 className="font-bold text-slate-800">Recent Signals Log</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">User / Session</th>
                                <th className="px-6 py-4 text-center">Rating</th>
                                <th className="px-6 py-4">Context</th>
                                <th className="px-6 py-4 text-right">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-sm">
                            {feedback.map((f) => (
                                <tr key={f.id} className="hover:bg-slate-50/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {getIconForType(f.type)}
                                            <span className="font-bold text-slate-700 whitespace-nowrap">
                                                {getLabelForType(f.type)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-900">
                                                {f.interview_sessions?.candidate_name || f.metadata?.recruiter_email || 'System'}
                                            </span>
                                            {f.interview_sessions?.role && (
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                    {f.interview_sessions.role}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {f.rating ? (
                                            <span className={cn(
                                                "inline-flex items-center justify-center w-8 h-8 rounded-lg font-black",
                                                f.rating >= 4 ? "bg-emerald-50 text-emerald-600" :
                                                    f.rating <= 2 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-600"
                                            )}>
                                                {f.rating}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-slate-600 italic">
                                            {f.comment || JSON.stringify(f.metadata || {})}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-400 font-medium">
                                        {formatRelativeTime(new Date(f.created_at))}
                                    </td>
                                </tr>
                            ))}
                            {feedback.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-400 italic">
                                        No feedback signals recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

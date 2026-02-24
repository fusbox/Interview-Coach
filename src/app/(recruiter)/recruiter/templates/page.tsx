"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Users, Lock, ChevronRight, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { fetchTemplates, deleteTemplateAction } from "./actions";
import { RecruiterTemplate } from "@/lib/domain/template";
import { Badge } from "@/components/ui/badge";

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<RecruiterTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const t = await fetchTemplates();
            setTemplates(t);
        } catch (error) {
            console.error("Failed to load templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template?")) return;

        setDeletingId(id);
        try {
            const res = await deleteTemplateAction(id);
            if (res.success) {
                setTemplates(prev => prev.filter(t => t.id !== id));
            } else {
                alert(res.error || "Failed to delete template");
            }
        } catch (error) {
            console.error("Delete template error:", error);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                    <Link href="/recruiter/create" className="flex items-center text-sm text-slate-500 hover:text-primary transition-colors mb-2">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Create Invite
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 font-display">Interview Templates</h1>
                    <p className="text-slate-500">Manage and reuse your question sets.</p>
                </div>
                <Link href="/recruiter/create">
                    <Button className="shadow-md">
                        Use a Template
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">Loading templates...</p>
                </div>
            ) : templates.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-300" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2 font-display">No Templates Found</h2>
                    <p className="text-slate-500 max-w-md mx-auto mb-8">
                        You haven&apos;t saved any templates yet. You can save your role and question sets while creating a new invite.
                    </p>
                    <Link href="/recruiter/create">
                        <Button variant="outline">Create New Invite</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template) => {
                        return (
                            <div key={template.id} className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 flex flex-col h-full overflow-hidden">
                                <div className="p-5 flex-1">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-primary/5 transition-colors">
                                            <FileText className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {template.isShared ? (
                                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 gap-1 font-normal">
                                                    <Users className="w-3 h-3" /> Shared
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-slate-50 text-slate-600 border-slate-100 gap-1 font-normal">
                                                    <Lock className="w-3 h-3" /> Private
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-slate-900 mb-1 line-clamp-1">{template.name}</h3>
                                    <p className="text-sm text-slate-500 mb-4 font-medium flex items-center">
                                        <span className="text-slate-400 mr-2 font-normal">Role:</span>
                                        {template.targetRole}
                                    </p>

                                    <div className="flex flex-wrap gap-2 mt-auto">
                                        <Badge variant="outline" className="text-[10px] py-0 h-5 border-slate-100 text-slate-500 font-normal">
                                            {template.questions.star?.length || 0} STAR
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] py-0 h-5 border-slate-100 text-slate-500 font-normal">
                                            {template.questions.perma?.length || 0} PERMA
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] py-0 h-5 border-slate-100 text-slate-500 font-normal">
                                            {template.questions.technical?.length || 0} Tech
                                        </Badge>
                                    </div>
                                </div>

                                <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                                    <div className="text-[10px] text-slate-400">
                                        Saved {new Date(template.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/5"
                                            onClick={() => handleDelete(template.id)}
                                            disabled={deletingId === template.id}
                                        >
                                            {deletingId === template.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </Button>
                                        <Link href="/recruiter/create">
                                            <Button size="sm" variant="ghost" className="h-8 text-primary hover:text-primary hover:bg-primary/5 px-2">
                                                Use <ChevronRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

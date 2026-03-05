"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Users, Lock, ChevronRight, Loader2, FileText, Plus, Search } from "lucide-react";
import Link from "next/link";
import { fetchTemplates, deleteTemplateAction } from "./actions";
import { RecruiterTemplate } from "@/lib/domain/template";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { EmptyState } from "@/components/patterns/EmptyState";

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<RecruiterTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        loadTemplates();
    }, []);

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.targetRole.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
        <div className="max-w-6xl mx-auto py-10 px-6 space-y-10 animate-in fade-in duration-slow">
            <SectionHeader
                title="Interview Templates"
                description="Manage and reuse your question sets for consistent interviews."
                actions={
                    <Link href="/recruiter/create">
                        <Button className="font-bold uppercase text-[10px] tracking-widest px-6 shadow-raised-1 h-11">
                            <Plus className="w-3.5 h-3.5 mr-2" /> New Template
                        </Button>
                    </Link>
                }
            />

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 bg-surface-subtle/30 rounded-3xl border border-border/10 shadow-flat-2">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-text-muted font-bold uppercase text-[10px] tracking-widest">Hydrating templates...</p>
                </div>
            ) : templates.length === 0 ? (
                <EmptyState
                    title="No Templates Found"
                    description="You haven't saved any templates yet. You can save your role and question sets while creating a new invite."
                    actions={
                        <Link href="/recruiter/create">
                            <Button variant="outline" className="font-bold uppercase text-[10px] tracking-widest px-8 mt-4 border-primary/20 hover:border-primary/50 text-primary">
                                Create Your First Invite
                            </Button>
                        </Link>
                    }
                />
            ) : (
                <div className="space-y-8">
                    {/* Search Bar */}
                    <div className="relative group max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by template name or role..."
                            className="w-full h-12 pl-12 pr-4 rounded-2xl border border-border bg-surface-subtle text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-base"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredTemplates.map((template) => {
                            return (
                                <div key={template.id} className="group flex flex-col h-full animate-in fade-in zoom-in-95 duration-base ease-standard">
                                    <div className="flex-1 bg-surface-base rounded-t-3xl border-t border-x border-border/40 p-6 shadow-raised-1 transition-all duration-base hover:shadow-raised-2">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="p-3 bg-surface-subtle rounded-2xl group-hover:bg-primary/5 transition-colors border border-border/10">
                                                <FileText className="w-6 h-6 text-text-disabled group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {template.isShared ? (
                                                    <Badge variant="secondary" className="bg-state-success/5 text-state-success border-state-success/10 gap-1 px-3 py-1 font-bold uppercase text-[9px] tracking-wider rounded-full">
                                                        <Users className="w-3 h-3" /> Shared
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-surface-subtle text-text-muted border-border/20 gap-1 px-3 py-1 font-bold uppercase text-[9px] tracking-wider rounded-full">
                                                        <Lock className="w-3 h-3" /> Private
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <h3 className="font-bold text-text-primary text-lg mb-1 line-clamp-1 tracking-tight">{template.name}</h3>
                                        <p className="text-sm text-text-muted mb-6 flex items-center font-medium">
                                            <span className="text-text-disabled mr-2 font-normal">Role:</span>
                                            {template.targetRole}
                                        </p>

                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-3 py-0.5 font-bold uppercase text-[9px] tracking-widest rounded-lg">
                                                {template.questions.star?.length || 0} STAR
                                            </Badge>
                                            <Badge variant="outline" className="bg-state-info/5 text-state-info border-state-info/10 px-3 py-0.5 font-bold uppercase text-[9px] tracking-widest rounded-lg">
                                                {template.questions.perma?.length || 0} PERMA
                                            </Badge>
                                            <Badge variant="outline" className="bg-state-warning/5 text-state-warning border-state-warning/10 px-3 py-0.5 font-bold uppercase text-[9px] tracking-widest rounded-lg">
                                                {template.questions.technical?.length || 0} Tech
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="px-6 py-5 bg-surface-subtle/40 rounded-b-3xl border-x border-b border-border/40 flex items-center justify-between border-t border-t-border/5 group-hover:bg-surface-subtle/80 transition-colors duration-base">
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">
                                            {new Date(template.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-10 w-10 text-text-disabled hover:text-state-critical hover:bg-state-critical/5 rounded-xl transition-all"
                                                onClick={() => handleDelete(template.id)}
                                                disabled={deletingId === template.id}
                                            >
                                                {deletingId === template.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                                                )}
                                            </Button>
                                            <Link href={`/recruiter/create?templateId=${template.id}`}>
                                                <Button size="sm" variant="ghost" className="h-10 text-primary font-bold uppercase text-[10px] tracking-widest hover:text-primary hover:bg-primary/5 px-4 rounded-xl transition-all flex items-center gap-2 group/btn">
                                                    Use Template <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

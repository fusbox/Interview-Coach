"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Users, Lock, ChevronRight, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { fetchTemplates, deleteTemplateAction, updateTemplateNameAction } from "./actions";
import { RecruiterTemplate } from "@/lib/domain/template";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/patterns/EmptyState";
import { AlertPanel } from "@/components/patterns/AlertPanel";
import { SearchField } from "@/components/patterns/SearchField";
import { PageHeaderBlock } from "@/components/patterns/PageHeaderBlock";
import { Check, X as CloseIcon } from "lucide-react";

interface EditableTemplateTitleProps {
    template: RecruiterTemplate;
    onUpdate: (newName: string) => Promise<boolean>;
    isEditable: boolean;
}

function EditableTemplateTitle({ template, onUpdate, isEditable }: EditableTemplateTitleProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(template.name);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setName(template.name);
    }, [template.name]);

    const handleSave = async () => {
        if (!name.trim() || name === template.name) {
            setIsEditing(false);
            setName(template.name);
            return;
        }

        setIsSaving(true);
        const success = await onUpdate(name);
        if (success) {
            setIsEditing(false);
        } else {
            // Restore name on failure if optimistic update isn't enough
            setName(template.name);
        }
        setIsSaving(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setName(template.name);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-left-1 duration-200">
                <input
                    autoFocus
                    className="flex-1 h-8 bg-surface-subtle border border-primary/30 rounded-lg px-3 text-sm font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') handleCancel();
                    }}
                    disabled={isSaving}
                />
                <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-emerald-800 hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                    <Button 
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-text-disabled hover:bg-surface-subtle"
                        onClick={handleCancel}
                        disabled={isSaving}
                    >
                        <CloseIcon className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between gap-4 w-full group/title">
            <h3 className="font-bold text-text-primary text-lg line-clamp-1">{template.name}</h3>
            {isEditable && (
                <Button 
                    emphasis="secondary"
                    density="compact"
                    shape="square"
                    label="strong"
                    className="h-8 border-primary/20 text-primary hover:bg-primary/5 focus:ring-2 focus:ring-primary/20"
                    onClick={() => setIsEditing(true)}
                >
                    Edit name
                </Button>
            )}
        </div>
    );
}

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<RecruiterTemplate[]>([]);
    const [recruiterId, setRecruiterId] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const filteredTemplates = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.targetRole.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadTemplates = async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            const { templates: t, recruiterId: rId, isAdmin: admin } = await fetchTemplates();
            setTemplates(t);
            setRecruiterId(rId || null);
            setIsAdmin(admin || false);
        } catch {
            setErrorMessage("Failed to load templates. Please refresh and try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateName = async (id: string, newName: string) => {
        // Optimistic update
        const originalTemplates = [...templates];
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));

        try {
            const res = await updateTemplateNameAction(id, newName);
            if (!res.success) {
                setTemplates(originalTemplates);
                setErrorMessage(res.error || "Failed to update template name.");
                return false;
            }
            setStatusMessage("Template name updated.");
            return true;
        } catch {
            setTemplates(originalTemplates);
            setErrorMessage("Failed to update template name.");
            return false;
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template?")) return;

        setDeletingId(id);
        try {
            const res = await deleteTemplateAction(id);
            if (res.success) {
                setTemplates(prev => prev.filter(t => t.id !== id));
                setStatusMessage("Template deleted.");
            } else {
                setErrorMessage(res.error || "Failed to delete template.");
            }
        } catch {
            setErrorMessage("Failed to delete template.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-12 space-y-10 animate-in fade-in duration-slow">
            <PageHeaderBlock
                title="Interview Templates"
                description="Manage and reuse your question sets for consistent interviews."
                actions={
                    <Link href="/recruiter/create">
                        <Button density="comfortable" shape="app" label="strong">
                            <Plus className="w-3.5 h-3.5 mr-2 text-primary-foreground" /> New Template
                        </Button>
                    </Link>
                }
            />

            {errorMessage && <AlertPanel tone="critical">{errorMessage}</AlertPanel>}
            {statusMessage && !errorMessage && <AlertPanel tone="success">{statusMessage}</AlertPanel>}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 bg-surface-subtle/30 rounded-2xl border border-border/10 shadow-flat-2">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-text-muted font-semibold uppercase text-micro tracking-widest">Hydrating templates...</p>
                </div>
            ) : templates.length === 0 ? (
                <EmptyState
                    title="No Templates Found"
                    description="You haven't saved any templates yet. You can save your role and question sets while creating a new invite."
                    actions={
                        <Link href="/recruiter/create">
                            <Button emphasis="primary" density="comfortable" shape="app" label="strong" className="mt-4">
                                Create Your First Invite
                            </Button>
                        </Link>
                    }
                />
            ) : (
                <div className="space-y-8">
                    {/* Search Bar */}
                    <SearchField
                        wrapperClassName="max-w-md"
                        placeholder="Search by template name or role..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="shadow-sm"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                        {filteredTemplates.map((template) => {
                            const isOwner = template.recruiterId === recruiterId;
                            const canManage = isOwner || isAdmin;
                            return (
                                <div key={template.id} className="group flex flex-col h-full animate-in fade-in zoom-in-95 duration-base ease-standard">
                                    <div className="flex-1 bg-surface-base rounded-t-2xl border-t border-x border-border/40 p-6 shadow-raised-1 transition-all duration-base hover:shadow-raised-2">
                                        <div className="flex items-center justify-between mb-4 min-h-[32px]">
                                            <EditableTemplateTitle 
                                                template={template} 
                                                onUpdate={(newName) => handleUpdateName(template.id, newName)}
                                                isEditable={canManage}
                                            />
                                        </div>

                                        <p className="text-sm text-text-muted mb-6 flex items-center font-medium">
                                            <span className="text-text-disabled mr-2 font-normal">Role:</span>
                                            {template.targetRole}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-2 pt-2">
                                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-3 py-0.5 font-bold uppercase text-[9px] tracking-widest rounded-lg">
                                                {template.questions.star?.length || 0} STAR
                                            </Badge>
                                            <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 px-3 py-0.5 font-bold uppercase text-[9px] tracking-widest rounded-lg dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-400/30">
                                                {template.questions.perma?.length || 0} PERMA
                                            </Badge>
                                            <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200 px-3 py-0.5 font-bold uppercase text-[9px] tracking-widest rounded-lg dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/30">
                                                {template.questions.technical?.length || 0} Tech
                                            </Badge>

                                            <div className="ml-auto">
                                                {template.isShared ? (
                                                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-400 gap-1 px-3 py-1 font-bold uppercase text-[9px] tracking-wider rounded-full dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/50">
                                                        <Users className="w-3 h-3" /> Shared
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-surface-subtle text-text-muted border-border/20 gap-1 px-3 py-1 font-bold uppercase text-[9px] tracking-wider rounded-full">
                                                        <Lock className="w-3 h-3" /> Private
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-6 py-5 bg-surface-subtle/40 rounded-b-2xl border-x border-b border-border/40 flex items-center gap-4 border-t border-t-border/5 group-hover:bg-surface-subtle/80 transition-colors duration-base">
                                        <div className="text-micro font-bold uppercase tracking-widest text-text-disabled whitespace-nowrap">
                                            {new Date(template.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                        <div className="flex items-center justify-end flex-1 gap-2">
                                            {canManage && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    shape="app"
                                                    className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 dark:text-rose-300 dark:hover:text-rose-200 dark:hover:bg-rose-500/10"
                                                    onClick={() => handleDelete(template.id)}
                                                    disabled={deletingId === template.id}
                                                >
                                                    {deletingId === template.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                                                    )}
                                                </Button>
                                            )}
                                            <Link href={`/recruiter/create?templateId=${template.id}`}>
                                                <Button emphasis="tertiary" density="default" shape="app" label="strong" className="gap-2 group/btn">
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

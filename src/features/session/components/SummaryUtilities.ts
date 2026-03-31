import { CheckCircle2, FileText, Zap, TrendingUp } from "lucide-react";
import { parseDebriefSections } from "@/lib/session-debrief";

export const getIconForTitle = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('summary')) return { icon: FileText, variant: 'info' as const };
    if (t.includes('strength')) return { icon: Zap, variant: 'success' as const };
    if (t.includes('growth')) return { icon: TrendingUp, variant: 'warning' as const };
    if (t.includes('next') || t.includes('momentum')) return { icon: CheckCircle2, variant: 'primary' as const };
    return { icon: FileText, variant: 'default' as const };
};

export const parseDebrief = (text?: string) => parseDebriefSections(text);

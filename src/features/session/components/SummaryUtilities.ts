import { CheckCircle2, FileText, Zap, TrendingUp } from "lucide-react";

export const getIconForTitle = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('summary')) return { icon: FileText, variant: 'info' as const };
    if (t.includes('strength')) return { icon: Zap, variant: 'success' as const };
    if (t.includes('growth')) return { icon: TrendingUp, variant: 'warning' as const };
    if (t.includes('next') || t.includes('readiness')) return { icon: CheckCircle2, variant: 'primary' as const };
    return { icon: FileText, variant: 'default' as const };
};

export const parseDebrief = (text?: string) => {
    if (!text) return [];
    const parts = text.split(/(?=### )/g).filter(p => p.trim() !== '');

    if (parts.length === 1 && !parts[0].trim().startsWith('###')) {
        return [{ title: "Session Debrief", content: text }];
    }

    return parts.map(part => {
        const lines = part.trim().split('\n');
        const titleLine = lines[0];
        const title = titleLine.replace(/^###\s*/, '').replace(/\*+/g, '').trim();
        const content = lines.slice(1).join('\n').trim();
        return { title, content };
    });
};

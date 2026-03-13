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
    
    // LLM cleanup: Find the first structural header and discard preambles
    const promptHeader = '### Executive Summary';
    const fallbackHeader = '### ';
    
    let startIndex = text.indexOf(promptHeader);
    if (startIndex === -1) {
        startIndex = text.indexOf(fallbackHeader);
    }
    
    const effectiveText = startIndex !== -1 ? text.slice(startIndex) : text;
    const parts = effectiveText.split(/(?=### )/g).filter(p => p.trim() !== '');

    if (parts.length === 1 && !parts[0].trim().startsWith('###')) {
        return [{ title: "Session Debrief", content: effectiveText }];
    }

    return parts.map(part => {
        const lines = part.trim().split('\n');
        const titleLine = lines[0];
        const title = titleLine.replace(/^###\s*/, '').replace(/\*+/g, '').trim();
        const content = lines.slice(1).join('\n').trim();
        return { title, content };
    });
};

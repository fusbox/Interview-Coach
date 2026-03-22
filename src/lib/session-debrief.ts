export interface DebriefSection {
    title: string;
    content: string;
}

export function parseDebriefSections(text?: string): DebriefSection[] {
    if (!text) return [];

    const promptHeader = "### Executive Summary";
    const fallbackHeader = "### ";

    let startIndex = text.indexOf(promptHeader);
    if (startIndex === -1) {
        startIndex = text.indexOf(fallbackHeader);
    }

    const effectiveText = startIndex !== -1 ? text.slice(startIndex) : text;
    const parts = effectiveText.split(/(?=### )/g).filter((part) => part.trim() !== "");

    if (parts.length === 1 && !parts[0].trim().startsWith("###")) {
        return [{ title: "Session Debrief", content: effectiveText.trim() }];
    }

    return parts.map((part) => {
        const lines = part.trim().split("\n");
        const titleLine = lines[0];
        const title = titleLine.replace(/^###\s*/, "").replace(/\*+/g, "").trim();
        const content = lines.slice(1).join("\n").trim();
        return { title, content };
    });
}

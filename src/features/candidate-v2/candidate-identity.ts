export function getCandidateInitials(displayName?: string | null, email?: string | null) {
    const source = displayName?.trim() || email?.trim() || "Candidate";
    const nameParts = source
        .replace(/@.*/, "")
        .split(/\s+/)
        .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
        .filter(Boolean);

    if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }

    return (nameParts[0] || "C").slice(0, 2).toUpperCase();
}

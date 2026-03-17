/**
 * Shared formatting utilities for common data types.
 */

/**
 * Format a duration in seconds into a human-readable string (e.g., "5m 30s").
 */
export function formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return "0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/**
 * Format a timestamp into a human-readable date/time string.
 */
export function formatTimestamp(timestamp?: number, timezone?: string): string {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    try {
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone || undefined
        });

        const tzName = new Intl.DateTimeFormat('en-US', {
            timeZoneName: 'short',
            timeZone: timezone || undefined
        }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value || "";

        return `${date.toLocaleDateString()} ${timeStr} ${tzName}`;
    } catch {
        return date.toLocaleString();
    }
}

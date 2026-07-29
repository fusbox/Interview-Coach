import { isIP } from "node:net";

export function readCandidateAccountRequestMetadata(request: Request) {
    const candidates = [
        request.headers.get("x-real-ip"),
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    ];
    return {
        ipAddress: candidates.find((value): value is string => Boolean(value && isIP(value))) ?? null,
        userAgent: request.headers.get("user-agent"),
    };
}

export async function readJsonBody(request: Request): Promise<unknown | null> {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

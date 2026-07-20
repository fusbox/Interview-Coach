import type { NextRequest } from "next/server";
import { protectRecruiterRoute } from "@/features/recruiter-auth-v2/recruiter-auth-middleware";

export function middleware(request: NextRequest) {
    return protectRecruiterRoute(request);
}

export const config = {
    matcher: ["/recruiter/:path*"],
};

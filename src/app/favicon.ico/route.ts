import { NextResponse } from "next/server";

export function GET(request: Request) {
    const response = NextResponse.redirect(new URL("/favicon.png?v=20260520", request.url), 307);
    response.headers.set("Cache-Control", "no-store");
    return response;
}

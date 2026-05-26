import { NextResponse } from 'next/server'

import { resolveCandidateLoginNext } from "@/lib/server/candidate-login-intent";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const next = resolveCandidateLoginNext(searchParams.get('next'))

    return NextResponse.redirect(`${origin}${next}`)
}

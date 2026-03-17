import { NextResponse } from "next/server";

export type ApiErrorCode =
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'INVALID_REQUEST'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR';

export type ApiErrorBody = {
    code: ApiErrorCode;
    message: string;
    correlationId: string;
    retryable: boolean;
};

export function errorResponse(status: number, body: ApiErrorBody) {
    return NextResponse.json(body, { status });
}

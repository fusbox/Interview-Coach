import { NextResponse } from "next/server";

export type ApiErrorCode =
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'INVALID_REQUEST'
    | 'IDEMPOTENCY_MISMATCH'
    | 'REQUEST_IN_PROGRESS'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR';

export type ApiErrorBody = {
    code: ApiErrorCode;
    message: string;
    correlationId: string;
    retryable: boolean;
};

export function createCorrelationId() {
    return crypto.randomUUID();
}

export function errorResponse(status: number, body: ApiErrorBody) {
    return NextResponse.json(body, { status });
}

export function unauthorizedResponse(correlationId: string, message: string = 'Authentication required') {
    return errorResponse(401, {
        code: 'UNAUTHORIZED',
        message,
        correlationId,
        retryable: false
    });
}

export function forbiddenResponse(correlationId: string, message: string = 'Access denied') {
    return errorResponse(403, {
        code: 'FORBIDDEN',
        message,
        correlationId,
        retryable: false
    });
}

export function notFoundResponse(correlationId: string, message: string = 'Resource not found') {
    return errorResponse(404, {
        code: 'NOT_FOUND',
        message,
        correlationId,
        retryable: false
    });
}

export function validationErrorResponse(correlationId: string, message: string = 'Invalid request') {
    return errorResponse(400, {
        code: 'INVALID_REQUEST',
        message,
        correlationId,
        retryable: false
    });
}

export function internalErrorResponse(correlationId: string, message: string = 'Internal server error') {
    return errorResponse(500, {
        code: 'INTERNAL_ERROR',
        message,
        correlationId,
        retryable: true
    });
}

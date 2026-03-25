export type RateLimitDecision = {
    allowed: boolean;
    remaining: number;
    resetAt: number;
};

export type RateLimitConsumeParams = {
    key: string;
    maxRequests: number;
    windowMs: number;
    now?: number;
};

export interface RateLimitBackend {
    consume(params: RateLimitConsumeParams): Promise<RateLimitDecision>;
    clear?(): Promise<void> | void;
}


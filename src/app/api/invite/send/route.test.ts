import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthenticatedRouteUserMock = vi.fn();
const sendInviteEmailMock = vi.fn();
const getSessionMock = vi.fn();
const markInvitationSentMock = vi.fn();

vi.mock('@/lib/server/auth/current-user', () => ({
    getAuthenticatedRouteUser: getAuthenticatedRouteUserMock
}));

vi.mock('@/lib/server/services/email-service', () => ({
    EmailService: {
        sendInviteEmail: sendInviteEmailMock
    }
}));

vi.mock('@/lib/server/infrastructure/postgres-session-repository', () => ({
    PostgresSessionRepository: class {
        get = getSessionMock;
        markInvitationSent = markInvitationSentMock;
    }
}));

vi.mock('@/lib/logger', () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('@/lib/server/rate-limit', () => ({
    consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 }))
}));

describe('POST /api/invite/send', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAuthenticatedRouteUserMock.mockResolvedValue({ id: 'user-1', email: 'recruiter@example.com' });
        sendInviteEmailMock.mockResolvedValue({ id: 'email-1' });
        getSessionMock.mockResolvedValue({ id: 's1', recruiterId: 'user-1' });
        markInvitationSentMock.mockResolvedValue(undefined);
    });

    it('returns 401 when unauthenticated', async () => {
        getAuthenticatedRouteUserMock.mockResolvedValue(null);
        const { POST } = await import('./route');

        const req = new Request('http://localhost/api/invite/send', {
            method: 'POST',
            body: JSON.stringify({})
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when payload is invalid', async () => {
        const { POST } = await import('./route');
        const req = new Request('http://localhost/api/invite/send', {
            method: 'POST',
            body: JSON.stringify({ role: 'QA Engineer' })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.code).toBe('INVALID_REQUEST');
        expect(sendInviteEmailMock).not.toHaveBeenCalled();
    });

    it('returns 403 when session ownership check fails', async () => {
        getSessionMock.mockResolvedValue({ id: 's1', recruiterId: 'user-2' });
        const { POST } = await import('./route');
        const req = new Request('http://localhost/api/invite/send', {
            method: 'POST',
            body: JSON.stringify({
                recipientEmail: 'candidate@example.com',
                recipientFirstName: 'Cand',
                role: 'QA Engineer',
                inviteLink: 'https://example.com/s/abc',
                recruiterName: 'Rec',
                sessionIds: ['s1']
            })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.code).toBe('FORBIDDEN');
        expect(sendInviteEmailMock).not.toHaveBeenCalled();
    });

    it('returns 429 when rate limited', async () => {
        const { consumeRateLimit } = await import('@/lib/server/rate-limit');
        vi.mocked(consumeRateLimit)
            .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 })
            .mockResolvedValueOnce({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });

        const { POST } = await import('./route');
        const req = new Request('http://localhost/api/invite/send', {
            method: 'POST',
            body: JSON.stringify({
                recipientEmail: 'candidate@example.com',
                recipientFirstName: 'Cand',
                role: 'QA Engineer',
                inviteLink: 'https://example.com/s/abc',
                recruiterName: 'Rec'
            })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(429);
        expect(body.code).toBe('RATE_LIMITED');
    });

    it('returns 200 for valid authenticated request', async () => {
        const { POST } = await import('./route');
        const req = new Request('http://localhost/api/invite/send', {
            method: 'POST',
            body: JSON.stringify({
                recipientEmails: ['candidate@example.com'],
                recipientFirstName: 'Cand',
                role: 'QA Engineer',
                inviteLink: 'https://example.com/s/abc',
                recruiterName: 'Rec',
                sessionIds: ['s1']
            })
        });

        const res = await POST(req as never);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.correlationId).toBeDefined();
        expect(sendInviteEmailMock).toHaveBeenCalledTimes(1);
        expect(markInvitationSentMock).toHaveBeenCalledWith('s1');
    });
});

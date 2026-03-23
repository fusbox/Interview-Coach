export const pilotRollout = {
    enabled: process.env.NEXT_PUBLIC_PILOT_ROLLOUT_ENABLED === 'true',
    supportName: process.env.NEXT_PUBLIC_PILOT_SUPPORT_NAME ?? 'Fu Chen',
    supportEmail: process.env.NEXT_PUBLIC_PILOT_SUPPORT_EMAIL ?? 'fu@rangam.com',
    supportPhone: process.env.NEXT_PUBLIC_PILOT_SUPPORT_PHONE ?? '(908) 704-8843',
} as const;

export function getPilotSupportLine() {
    return `${pilotRollout.supportName} at ${pilotRollout.supportPhone} or ${pilotRollout.supportEmail}`;
}

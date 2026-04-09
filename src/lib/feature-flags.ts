/**
 * Feature Flags Utility
 * 
 * Allows for 'Development Only' features to be enabled in Production
 * specifically for demonstrations/staging.
 */

export const showDemoTools = () => {
    // Check both public client-side and server-side environment variables
    const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO_TOOLS === 'true';
    const isDev = process.env.NODE_ENV === 'development';

    return showDemo || isDev;
};

const REPLAY_TOUR_INTERNAL_EMAILS = [
    "fu@rangam.com",
];

export const canShowReplayTourButton = (userEmail?: string | null) => {
    if (showDemoTools()) {
        return true;
    }

    if (!userEmail) {
        return false;
    }

    return REPLAY_TOUR_INTERNAL_EMAILS.includes(userEmail.toLowerCase());
};

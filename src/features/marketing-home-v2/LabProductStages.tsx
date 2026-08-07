import { LabProductCapture } from "./LabProductCapture";

export function SetupStage() {
    return (
        <LabProductCapture
            desktopSrc="/marketing/product/setup-desktop.png"
            mobileSrc="/marketing/product/setup-mobile.png"
            alt="Interview Coach practice setup with role, interview stage, and question count"
            desktopHeight={1937}
            mobileHeight={2213}
        />
    );
}

export function LandingStage() {
    return (
        <LabProductCapture
            desktopSrc="/marketing/product/pre-session-desktop.png"
            mobileSrc="/marketing/product/pre-session-mobile.png"
            alt="Pre-session landing showing the role, visit size, and planned interview questions"
            desktopHeight={1108}
            mobileHeight={1485}
        />
    );
}

export function SessionStage() {
    return (
        <LabProductCapture
            desktopSrc="/marketing/product/session-desktop.png"
            mobileSrc="/marketing/product/session-mobile.png"
            alt="Live interview practice with one question and a private typed answer composer"
        />
    );
}

export function CoachingStage() {
    return (
        <LabProductCapture
            desktopSrc="/marketing/product/feedback-expanded-desktop.png"
            mobileSrc="/marketing/product/feedback-expanded-mobile.png"
            alt="Expanded post-answer coaching with a focused improvement and answer structure"
        />
    );
}

export function DashboardStage() {
    return (
        <LabProductCapture
            desktopSrc="/marketing/product/dashboard-desktop.png"
            mobileSrc="/marketing/product/dashboard-mobile.png"
            alt="Candidate dashboard with a new Coach Update, Coach Plan progress, and next practice options"
            mobileHeight={1174}
        />
    );
}

export function QueueStage() {
    return (
        <LabProductCapture
            desktopSrc="/marketing/product/next-round-desktop.png"
            mobileSrc="/marketing/product/next-round-mobile.png"
            alt="Next Round builder with queued questions and more Coach Plan questions available to add"
        />
    );
}

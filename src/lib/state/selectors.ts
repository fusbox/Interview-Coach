import { InterviewSession } from "@/lib/domain/types";
import { NowState, ScreenId } from "./now.types";

export function selectNow(session?: InterviewSession | null): NowState {
    if (session === undefined) {
        return {
            isLoaded: false,
            status: "NOT_STARTED",
            requiresInitials: false,
            canStart: false,
            isComplete: false,
            currentQuestionIndex: 0,
            totalQuestions: 0,
            screen: "LANDING",
        };
    }

    if (session === null) {
        return {
            isLoaded: true,
            status: "ERROR",
            requiresInitials: false,
            canStart: false,
            isComplete: false,
            currentQuestionIndex: 0,
            totalQuestions: 0,
            screen: "ERROR",
        };
    }

    const { status, initialsRequired, questions, currentQuestionIndex, answers } = session;

    const isComplete = status === "COMPLETED";
    const currentQ = questions[currentQuestionIndex];
    const currentAns = currentQ ? answers[currentQ.id] : undefined;

    let screen: ScreenId = "ERROR";

    if (status === "ERROR") {
        screen = "ERROR";
    } else if (initialsRequired) {
        screen = "INITIALS";
    } else if (status === "NOT_STARTED") {
        screen = "LANDING";
    } else if (status === "COMPLETED") {
        screen = "SUMMARY";
    } else {
        if (currentAns?.analysis) {
            screen = "REVIEW_FEEDBACK";
        } else if (status === "AWAITING_EVALUATION" || (currentAns?.submittedAt && !currentAns.analysis)) {
            screen = "PENDING_EVALUATION";
        } else if (status === "REVIEWING") {
            screen = "REVIEW_FEEDBACK";
        } else {
            screen = "ACTIVE_QUESTION";
        }
    }

    return {
        isLoaded: true,
        status,
        role: session.role,
        requiresInitials: initialsRequired,
        canStart: status === "NOT_STARTED",
        isComplete,
        currentQuestionId: currentQ?.id,
        currentQuestionIndex,
        totalQuestions: questions.length,
        screen,
    };
}

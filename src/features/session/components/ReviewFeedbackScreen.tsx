import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useSession } from "../context/SessionContext"
import { ArrowRight, CheckCircle } from "lucide-react"

// Ensure you import the CSS in layout or here (Global CSS preferred usually, but simple import works if configured)
import "@/styles/loader.css"

export default function ReviewFeedbackScreen() {
    const { session, nextQuestion, retryQuestion, updateSession, analyzeCurrentQuestion } = useSession(); // Corrected destructuring
    const currentQ = session?.questions[session.currentQuestionIndex];
    // Safe access:
    const answer = currentQ ? session?.answers[currentQ.id] : undefined;
    const analysis = answer?.analysis;

    // State and loaders removed due to static layout

    const isThinking = !analysis || (!analysis.contentPulse && !analysis.deliveryPulse);

    // --- Ported Logic from PendingEvaluationScreen ---
    const hasTriggered = useRef(false);
    const lastQuestionId = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (!session) return;
        const currentQuestionId = session.questions[session.currentQuestionIndex]?.id;

        // Reset trigger if question changes
        if (currentQuestionId && currentQuestionId !== lastQuestionId.current) {
            lastQuestionId.current = currentQuestionId;
            hasTriggered.current = false;
        }

        // Trigger analysis if needed (and we are in a state that implies waiting)
        // If we don't have analysis, we should trigger it.
        // FIX: If we ALREADY have analysis (and it's not the loader state), DO NOT trigger.
        // This prevents the "overwrite" glitch where V1 is replaced by V2.
        if (isThinking && !hasTriggered.current) {
            hasTriggered.current = true;
            analyzeCurrentQuestion();
        } else if (!isThinking) {
            // We have analysis, mark as done so we don't re-trigger if logic blips
            hasTriggered.current = true;
        }

        // Poll for completion in case the initial trigger happened but we are waiting for async result
        const interval = setInterval(() => {
            if (isThinking) {
                analyzeCurrentQuestion();
            }
        }, 5000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isThinking]);

    if (!session || !currentQ || !answer) return <div className="p-8">No session data.</div>;

    // Helper mapping removed

    const handleStop = async () => {
        await updateSession(session.id, { status: "PAUSED" });
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">

            {/* Answer Readonly Panel (Top) */}
            <div className="bg-white border-b px-6 py-4 shadow-sm">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Your Answer
                    </h2>
                    <p className="text-lg text-slate-800 leading-relaxed font-sans italic opacity-90">
                        &quot;{answer.transcript}&quot;
                    </p>
                </div>
            </div>

            {/* Feedback Region */}
            <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col gap-6 animate-in fade-in duration-500">

                {isThinking ? (
                    <div className="thinking-loader p-8 bg-white rounded-xl shadow-sm mt-4 border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                        </div>
                        <div className="skeleton-line" />
                        <div className="skeleton-line short" />
                        <div className="skeleton-line" />
                    </div>
                ) : (
                    <>
                        {/* Ack Text */}
                        <div className="text-slate-600 font-medium px-1 text-lg">
                            {analysis.ack}
                        </div>

                        {/* Content Pulse Block */}
                        {analysis.contentPulse && (
                            <div className="bg-white border border-l-4 border-l-emerald-500 rounded-lg shadow-sm p-6 space-y-3">
                                <h3 className="text-xl font-bold text-slate-900 border-b border-emerald-100 pb-2">
                                    {analysis.contentPulse.headline}
                                </h3>
                                <p className="text-slate-700 leading-relaxed font-medium">
                                    {analysis.contentPulse.body}
                                </p>
                                {analysis.contentPulse.quote && (
                                    <p className="text-sm text-emerald-700 italic border-l-2 border-emerald-300 pl-3 py-1 bg-emerald-50/50">
                                        &ldquo;{analysis.contentPulse.quote}&rdquo;
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Delivery Pulse Block */}
                        {analysis.deliveryPulse && (
                            <div className="bg-white border border-l-4 border-l-indigo-500 rounded-lg shadow-sm p-6 space-y-3 mt-4">
                                <h3 className="text-xl font-bold text-slate-900 border-b border-indigo-100 pb-2">
                                    {analysis.deliveryPulse.headline}
                                </h3>
                                <p className="text-slate-700 leading-relaxed font-medium">
                                    {analysis.deliveryPulse.body}
                                </p>
                            </div>
                        )}

                        {/* Suggested Action (Text Only) */}
                        {analysis.nextAction && (
                            <div className="px-1 pt-2">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Suggested Action</p>
                                <p className="text-slate-700 font-medium">{analysis.nextAction.label}</p>
                            </div>
                        )}

                        {/* Actions Buttons */}
                        <div className="pt-2 flex flex-col gap-3">
                            <Button
                                size="lg"
                                className="w-full text-lg h-12 shadow-md hover:shadow-lg transition-all bg-blue-600 hover:bg-blue-700"
                                onClick={nextQuestion}
                            >
                                {session.currentQuestionIndex >= session.questions.length - 1 ? (
                                    <>Finish Session <CheckCircle className="ml-2 w-5 h-5" /></>
                                ) : (
                                    <>Continue to the Next Question <ArrowRight className="ml-2 w-5 h-5" /></>
                                )}
                            </Button>

                            <button
                                onClick={() => retryQuestion()}
                                className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors py-2"
                            >
                                I&apos;d like to try my answer again
                            </button>

                            {!session || session.currentQuestionIndex < session.questions.length - 1 && (
                                <button
                                    onClick={handleStop}
                                    className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors py-2"
                                >
                                    Stop for now
                                </button>
                            )}
                        </div>
                    </>
                )}

            </main>
        </div>
    )
}

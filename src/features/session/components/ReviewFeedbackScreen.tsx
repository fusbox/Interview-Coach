import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useSession } from "../context/SessionContext"
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, ArrowRight, CheckCircle } from "lucide-react"

// Ensure you import the CSS in layout or here (Global CSS preferred usually, but simple import works if configured)
import "@/styles/loader.css"

export default function ReviewFeedbackScreen() {
    const { session, nextQuestion, retryQuestion, updateSession, analyzeCurrentQuestion } = useSession(); // Corrected destructuring
    const currentQ = session?.questions[session.currentQuestionIndex];
    // Safe access:
    const answer = currentQ ? session?.answers[currentQ.id] : undefined;
    const analysis = answer?.analysis;

    const [whyOpen, setWhyOpen] = useState(false);
    const [obsOpen, setObsOpen] = useState(false);

    // If no analysis yet, we show loader
    const isThinking = !analysis || !analysis.primaryFocus;

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

    // Helper: Label Mapping
    const getDimensionLabel = (dim: string) => {
        const map: Record<string, string> = {
            'specificity_concreteness': 'Specific & Concrete',
            'outcome_explicitness': 'Outcome Clarity',
            'structural_clarity': 'Structure',
            'decision_rationale': 'Decision Logic',
            'focus_relevance': 'Focus'
        };
        return map[dim] || dim.replace(/_/g, " ");
    };

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

                        {/* Primary Focus Block */}
                        <div className="bg-white border border-l-4 border-l-blue-500 rounded-lg shadow-sm p-6 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-blue-50 text-blue-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wide">
                                    {analysis.primaryFocus?.dimension ? getDimensionLabel(analysis.primaryFocus.dimension) : 'Feedback'}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">
                                {analysis.primaryFocus?.headline}
                            </h3>
                            <p className="text-slate-700 leading-relaxed">
                                {analysis.primaryFocus?.body}
                            </p>
                        </div>

                        {/* Collapsible: Why this helps */}
                        {analysis.whyThisMatters && (
                            <div className="border rounded-lg bg-white overflow-hidden">
                                <button
                                    onClick={() => setWhyOpen(!whyOpen)}
                                    // Header Styling: Light Blue (More visible)
                                    className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors text-left border-b border-transparent hover:border-blue-200"
                                >
                                    <span className="font-semibold text-slate-700 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-slate-400" />
                                        Why this helps
                                    </span>
                                    {whyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                {whyOpen && (
                                    <div className="p-4 pt-4 text-slate-600 bg-white">
                                        {analysis.whyThisMatters}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Collapsible: What I noticed */}
                        {analysis.observations && analysis.observations.length > 0 && (
                            <div className="border rounded-lg bg-white overflow-hidden">
                                <button
                                    onClick={() => setObsOpen(!obsOpen)}
                                    // Header Styling: Blue Match
                                    className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors text-left border-b border-transparent hover:border-blue-200"
                                >
                                    <span className="font-semibold text-slate-700 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-slate-400" />
                                        What I noticed
                                    </span>
                                    {obsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                {obsOpen && (
                                    <ul className="p-4 pt-2 space-y-2 border-t bg-slate-50/50">
                                        {analysis.observations.map((obs, idx) => (
                                            <li key={idx} className="flex gap-2 text-slate-600 text-sm">
                                                <span className="opacity-50">•</span> {obs}
                                            </li>
                                        ))}
                                    </ul>
                                )}
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

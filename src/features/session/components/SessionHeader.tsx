import React from 'react';
import { useSession } from '../context/SessionContext';
import { X } from 'lucide-react';

export function SessionHeader() {
    const { session, trackEvent, updateSession } = useSession();

    if (!session) return null;
    const { questions, currentQuestionIndex } = session;

    const handleExit = async () => {
        if (window.confirm("Are you sure you want to exit? Your progress is saved.")) {
            trackEvent('tier2', 'session_stop_early');
            await updateSession(session.id, { status: 'PAUSED' });
        }
    };

    const percentage = Math.round(((currentQuestionIndex + 1) / questions.length) * 100);

    return (
        <header className="border-b bg-white/50 dark:bg-neutral-900/50 backdrop-blur-md sticky top-0 z-20 shrink-0 overflow-hidden">
            <div className="w-full max-w-4xl mx-auto px-4 md:px-6 lg:px-10 py-4 pb-3">
                <div className="flex justify-between items-end mb-3">
                    {/* Left: Session Info */}
                    <div className="flex flex-col items-start gap-1 max-w-[50%] md:max-w-[60%]">
                        <h1 className="text-sm md:text-base font-black text-slate-900 dark:text-white leading-none tracking-tight truncate w-full">
                            {session.candidateName ? `${session.candidateName} • ${session.role}` : session.role}
                        </h1>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums uppercase tracking-widest">
                            Question {currentQuestionIndex + 1} of {questions.length}
                        </span>
                    </div>

                    {/* Right: Percent & Exit */}
                    <div className="flex items-center gap-6">
                        <span className="text-sm font-bold text-blue-600 tracking-tight">
                            {percentage}% Complete
                        </span>
                        <div className="w-px h-4 bg-slate-200 dark:bg-white/10" />
                        <button
                            onClick={handleExit}
                            className="group flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            aria-label="Exit session"
                        >
                            <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">Exit Session</span>
                            <X size={16} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Bottom: Progress Bar */}
                <div className="h-1.5 w-full bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden shadow-inner">
                    <div
                        className="bg-blue-600 h-full transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) rounded-full shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        </header>
    );
}

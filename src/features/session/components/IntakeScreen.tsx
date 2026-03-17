import { useState } from "react";

import { cn } from "@/lib/cn";

interface IntakeScreenProps {
    onComplete: (preference: 'tier0' | 'tier1' | 'tier2') => void;
}

export default function IntakeScreen({ onComplete }: IntakeScreenProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSelect = async (preference: 'tier0' | 'tier1' | 'tier2') => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onComplete(preference);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
            <div className="max-w-md w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header */}
                <div className="space-y-2 text-center sm:text-left">
                    <h1 className="text-2xl font-bold text-foreground">
                        What kind of feedback would you like?
                    </h1>
                    <p className="text-xs text-muted-foreground pt-1">
                        You can change this later.
                    </p>
                </div>

                {/* Options */}
                <div className="space-y-3">
                    <button
                        onClick={() => handleSelect('tier0')}
                        disabled={isSubmitting}
                        className={cn(
                            "w-full text-left p-4 rounded-xl border-2 border-transparent bg-muted/50 hover:bg-muted hover:border-primary/50 transition-all duration-200 group",
                            isSubmitting && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Just help me practice and feel comfortable</div>
                        <div className="text-sm text-muted-foreground mt-1">Best if you’re warming up or trying this for the first time.</div>
                    </button>

                    <button
                        onClick={() => handleSelect('tier1')}
                        disabled={isSubmitting}
                        className={cn(
                            "w-full text-left p-4 rounded-xl border-2 border-transparent bg-muted/50 hover:bg-muted hover:border-primary/50 transition-all duration-200 group",
                            isSubmitting && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Help me improve how I answer interview questions</div>
                        <div className="text-sm text-muted-foreground mt-1">Focused on clarity and structure.</div>
                    </button>

                    <button
                        onClick={() => handleSelect('tier2')}
                        disabled={isSubmitting}
                        className={cn(
                            "w-full text-left p-4 rounded-xl border-2 border-transparent bg-muted/50 hover:bg-muted hover:border-primary/50 transition-all duration-200 group",
                            isSubmitting && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">Give me targeted coaching for this role</div>
                        <div className="text-sm text-muted-foreground mt-1">More specific guidance, when you want it.</div>
                    </button>
                </div>

                {/* No Start Button */}
            </div>
        </div>
    );
}

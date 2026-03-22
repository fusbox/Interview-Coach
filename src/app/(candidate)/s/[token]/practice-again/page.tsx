"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useSession } from "@/features/session/context/SessionContext";
import { Button } from "@/components/ui/button";

export default function PracticeAgainPage() {
    const router = useRouter();
    const params = useParams<{ token: string }>();
    const { session, isLoading, createNewSession } = useSession();
    const [error, setError] = useState<string | null>(null);
    const hasStartedRef = useRef(false);

    useEffect(() => {
        if (isLoading || !session || hasStartedRef.current) {
            return;
        }

        hasStartedRef.current = true;

        createNewSession(session.role, session.id)
            .then((result) => {
                if (!result?.candidateToken) {
                    throw new Error("Unable to start a new practice round.");
                }

                router.replace(`/s/${result.candidateToken}`);
            })
            .catch((cause) => {
                hasStartedRef.current = false;
                setError(cause instanceof Error ? cause.message : "Unable to start a new practice round.");
            });
    }, [createNewSession, isLoading, router, session]);

    return (
        <div className="flex min-h-[70dvh] items-center justify-center px-6 py-12">
            <div className="w-full max-w-xl rounded-[2rem] border border-border bg-background p-8 shadow-floating text-center">
                {error ? (
                    <>
                        <h1 className="text-2xl font-bold text-text-primary">Couldn&apos;t start a new round</h1>
                        <p className="mt-3 text-base leading-relaxed text-text-secondary">
                            {error}
                        </p>
                        <div className="mt-8 flex justify-center">
                            <Button
                                emphasis="primary"
                                density="comfortable"
                                shape="pill"
                                label="strong"
                                onClick={() => {
                                    setError(null);
                                    hasStartedRef.current = false;
                                    router.replace(`/s/${params.token}`);
                                }}
                            >
                                Back to Session
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <RotateCcw className="h-7 w-7" />
                        </div>
                        <h1 className="mt-6 text-2xl font-bold text-text-primary">Starting your next practice round</h1>
                        <p className="mt-3 text-base leading-relaxed text-text-secondary">
                            We&apos;re setting up a fresh session with the same role so you can jump back in immediately.
                        </p>
                        <div className="mt-8 flex justify-center">
                            <Loader2 className="h-7 w-7 animate-spin text-primary" />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

'use client';

import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Logger } from "@/lib/logger";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        Logger.error('Unhandled Runtime Error', error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background">
            <div className="max-w-md space-y-4">
                <h2 className="text-2xl font-bold text-destructive">Something went wrong!</h2>
                <p className="text-muted-foreground">
                    We apologize for the inconvenience. An unexpected error has occurred.
                </p>
                <div className="pt-4 flex justify-center gap-4">
                    <Button
                        onClick={
                            // Attempt to recover by trying to re-render the segment
                            () => reset()
                        }
                    >
                        Try again
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => window.location.href = '/'}
                    >
                        Go Home
                    </Button>
                </div>
            </div>
        </div>
    );
}

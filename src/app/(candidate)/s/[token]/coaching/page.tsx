"use client";

import { useSession } from '@/features/session/context/SessionContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { computeMetrics, generateSignals, SignalQuality } from '@/lib/services/dashboard-constitution';

export default function CoachingPage({ params }: { params: { token: string } }) {
    const { session, isLoading } = useSession();

    const signals = useMemo(() => {
        if (!session) return null;
        const metrics = computeMetrics(session);
        return generateSignals(session, metrics);
    }, [session]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50dvh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!session || !signals) {
        return <div>Session failed to load.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link href={`/s/${params.token}`} passHref>
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Practice
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold tracking-tight text-primary">Coaching Insight</h1>
            </div>

            {/* 1. Baseline Block */}
            <Card className="border-l-4 border-l-primary bg-surface-subtle/50">
                <CardHeader>
                    <CardDescription className="uppercase tracking-widest text-micro font-semibold">Current Baseline</CardDescription>
                    <CardTitle className="text-xl md:text-2xl font-sans font-medium leading-relaxed">
                        {signals.baseline.text}
                    </CardTitle>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 2. Constellation (Stub) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Competency Profile</CardTitle>
                        <CardDescription>Relative strengths based on observed evidence.</CardDescription>
                    </CardHeader>
                    <CardContent className="min-h-[200px] flex items-center justify-center text-muted-foreground italic">
                        {signals.baseline.quality === SignalQuality.Insufficient
                            ? "Not enough data to map competencies."
                            : "Visualization coming soon..."}
                    </CardContent>
                </Card>

                {/* 3. Coaching Focus */}
                <Card className="bg-primary text-primary-foreground">
                    <CardHeader>
                        <CardDescription className="text-primary-foreground/80">Recommended Focus</CardDescription>
                        <CardTitle>{signals.coachingFocus.focus}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-lg opacity-90">{signals.coachingFocus.rationale}</p>
                        <div className="pt-4 border-t border-primary-foreground/20">
                            <div className="text-sm font-semibold uppercase tracking-wider mb-2 opacity-80">Next Action</div>
                            <p className="font-medium">{signals.coachingFocus.action}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}

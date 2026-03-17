"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionHeader } from "@/components/patterns/SectionHeader"
import { MetricCard } from "@/components/patterns/MetricCard"
import { EmptyState } from "@/components/patterns/EmptyState"
import { ErrorState } from "@/components/patterns/ErrorState"
import { FeedbackPanel } from "@/components/patterns/FeedbackPanel"
import { DataTable } from "@/components/patterns/DataTable"
import { Info, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, Archive, Plus, MessageSquare } from "lucide-react"

interface SampleData {
    name: string
    status: string
    score: string
}

export function ComponentGallery() {
    return (
        <div className="space-y-12 pb-20">
            <SectionHeader
                title="Design System Gallery"
                description="Live preview of canonical tokens and primitives for Phase 1 hardening."
                size="lg"
            />

            {/* 1. Typography & Colors */}
            <section className="space-y-6">
                <SectionHeader title="1. Foundations" size="sm" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Typography Scale</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">Display</p>
                                <p className="text-4xl font-display font-black">Design Mastery</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">H1 / Heading-lg</p>
                                <p className="text-3xl font-bold">Canonical Baseline</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">H2 / Heading-md</p>
                                <p className="text-2xl font-bold">Structural Integrity</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">Body Large</p>
                                <p className="text-lg">The quick brown fox jumps over the lazy dog.</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-micro font-bold text-muted-foreground uppercase tracking-widest">Body Default</p>
                                <p className="text-base text-text-primary">Reliable and predictable layouts require strict tokens.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Semantic States</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-state-info flex items-center justify-center text-white">
                                    <Info size={24} />
                                </div>
                                <div>
                                    <p className="font-bold">Info / Primary</p>
                                    <p className="text-sm text-muted-foreground">--state-info</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-state-success flex items-center justify-center text-white">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <p className="font-bold">Success / High Readiness</p>
                                    <p className="text-sm text-muted-foreground">--state-success</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-state-warning flex items-center justify-center text-white">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <p className="font-bold">Warning / Medium Readiness</p>
                                    <p className="text-sm text-muted-foreground">--state-warning</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-state-critical flex items-center justify-center text-white">
                                    <AlertCircle size={24} />
                                </div>
                                <div>
                                    <p className="font-bold">Critical / Low Readiness</p>
                                    <p className="text-sm text-muted-foreground">--state-critical</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* 2. Radius & Elevation */}
            <section className="space-y-6">
                <SectionHeader title="2. Radius & Elevation" size="sm" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <div className="h-24 bg-card border shadow-flat rounded-sm flex items-center justify-center font-bold">sm</div>
                        <p className="text-micro text-center font-bold text-muted-foreground uppercase">4px / Flat</p>
                    </div>
                    <div className="space-y-2">
                        <div className="h-24 bg-card border shadow-raised-1 rounded-md flex items-center justify-center font-bold">md</div>
                        <p className="text-micro text-center font-bold text-muted-foreground uppercase">8px / Raised-1</p>
                    </div>
                    <div className="space-y-2">
                        <div className="h-24 bg-card border shadow-raised-2 rounded-lg flex items-center justify-center font-bold">lg</div>
                        <p className="text-micro text-center font-bold text-muted-foreground uppercase">12px / Raised-2</p>
                    </div>
                    <div className="space-y-2">
                        <div className="h-24 bg-card border shadow-floating rounded-xl flex items-center justify-center font-bold">xl</div>
                        <p className="text-micro text-center font-bold text-muted-foreground uppercase">16px / Floating</p>
                    </div>
                </div>
            </section>

            {/* 3. Button Variants */}
            <section className="space-y-6">
                <SectionHeader title="3. Primitives: Buttons" size="sm" />
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap gap-4 items-center">
                            <Button variant="default">Default Blue</Button>
                            <Button variant="secondary">Secondary Neutral</Button>
                            <Button variant="outline">Outline Flat</Button>
                            <Button variant="destructive">Destructive Red</Button>
                            <Button variant="info">Info / Bio Blue</Button>
                            <Button variant="ghost">Ghost Transition</Button>
                            <Button variant="link">External Link</Button>
                        </div>
                        <div className="mt-8 flex flex-wrap gap-4 items-center">
                            <Button size="sm">Small Action</Button>
                            <Button>Regular Size</Button>
                            <Button size="lg">Hero Action</Button>
                            <Button size="icon" variant="outline"><Sparkles size={16} /></Button>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 4. Pattern: Badges */}
            <section className="space-y-6">
                <SectionHeader title="4. Pattern: Badges" size="sm" />
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase mb-4">Semantic States (Standard Badges)</p>
                            <div className="flex flex-wrap gap-4">
                                <Badge variant="success">Success</Badge>
                                <Badge variant="warning">Warning</Badge>
                                <Badge variant="info">Info</Badge>
                                <Badge variant="destructive">Critical</Badge>
                                <Badge variant="outline">Outline</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* 5. Pattern: MetricCards */}
            <section className="space-y-6">
                <SectionHeader title="5. Pattern: MetricCards" size="sm" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <MetricCard
                        title="Average Score"
                        value="8.4"
                        trend={{ value: "12%", positive: true }}
                    />
                    <MetricCard
                        title="Total Sessions"
                        value="124"
                        trend={{ value: "5%", positive: true }}
                    />
                    <MetricCard
                        title="Growth Rate"
                        value="22%"
                        trend={{ value: "2%", positive: false }}
                    />
                </div>
            </section>

            {/* 6. Pattern: EmptyState */}
            <section className="space-y-6">
                <SectionHeader title="6. Pattern: EmptyState" size="sm" />
                <EmptyState
                    title="No sessions found"
                    description="When you start scheduling interviews, they will appear here for tracking and coaching."
                    icon={<Archive size={48} className="text-muted-foreground/30" />}
                    actions={
                        <Button>
                            <Plus size={16} className="mr-2" />
                            Create Session
                        </Button>
                    }
                />
            </section>

            {/* 7. Pattern: ErrorState */}
            <section className="space-y-6">
                <SectionHeader title="7. Pattern: ErrorState" size="sm" />
                <ErrorState
                    title="Failed to fetch benchmarks"
                    description="The connection to the scoring service was interrupted."
                    error="Socket closed prematurely: connection_reset_by_peer"
                    onRetry={() => alert("Retrying...")}
                />
            </section>

            {/* 8. Pattern: FeedbackPanel */}
            <section className="space-y-6">
                <SectionHeader title="8. Pattern: FeedbackPanel" size="sm" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FeedbackPanel
                        title="Candidate Confidence"
                        body="The candidate maintained strong eye contact and vocal steady throughout the delivery, even when facing challenging technical questions."
                        assessment="outstanding"
                        icon={<MessageSquare size={16} />}
                    />
                    <FeedbackPanel
                        title="Technical Depth"
                        body="While the candidate understood the core concepts, they struggled to explain the trade-offs of the chosen architecture."
                        assessment="growth"
                        icon={<MessageSquare size={16} />}
                    />
                </div>
            </section>

            {/* 9. Pattern: DataTable */}
            <section className="space-y-6">
                <SectionHeader title="9. Pattern: DataTable" size="sm" />
                <DataTable<SampleData>
                    columns={[
                        { header: "Candidate", accessorKey: "name", className: "font-semibold" },
                        { header: "Status", cell: (item) => <Badge variant="outline">{item.status}</Badge> },
                        { header: "Score", accessorKey: "score", className: "text-right" }
                    ]}
                    data={[
                        { name: "John Doe", status: "Active", score: "8.5" },
                        { name: "Jane Smith", status: "Review", score: "7.2" },
                        { name: "Bob Wilson", status: "Archived", score: "N/A" }
                    ]}
                />
            </section>

            {/* 10. Card: Glassmorphism */}
            <section className="space-y-6">
                <SectionHeader title="10. Primitives: Card Variants" size="sm" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative p-12 overflow-hidden rounded-3xl bg-slate-900 shadow-inner">
                    {/* Background decorations for glass effect */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[120px] opacity-20" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500 rounded-full blur-[120px] opacity-20" />

                    <Card variant="default">
                        <CardHeader>
                            <CardTitle>Default Surface</CardTitle>
                            <CardDescription>Opaque background, standard border.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">Used for core data views where maximum contrast and readability are required.</p>
                        </CardContent>
                    </Card>

                    <Card variant="glass">
                        <CardHeader>
                            <CardTitle className="text-white">Glass Surface</CardTitle>
                            <CardDescription className="text-white/70">Translucent background with heavy blur.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-white/90">Used for hero sections and modal overlays to create a premium, spatial feel.</p>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    )
}

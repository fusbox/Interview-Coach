"use client"

import * as React from "react"
import { AlertPanel } from "@/components/patterns/AlertPanel"
import { ContentCard } from "@/components/patterns/ContentCard"
import { FeedbackChoiceButton } from "@/components/patterns/FeedbackChoiceButton"
import { FeedbackPanel } from "@/components/patterns/FeedbackPanel"
import { InsightCard } from "@/components/patterns/InsightCard"
import { SessionPromptShell } from "@/components/patterns/SessionPromptShell"
import { SectionHeader } from "@/components/patterns/SectionHeader"
import { SearchField } from "@/components/patterns/SearchField"
import { StatusBadge } from "@/components/patterns/StatusBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    FileText,
    Info,
    LayoutDashboard,
    PlayCircle,
    Plus,
    RotateCcw,
    Save,
    SendHorizontal,
    Trash2,
    X,
} from "lucide-react"

const colorFamilies = [
    {
        name: "Primary",
        usage: "Main actions, active states, and semantic info surfaces. `state-info` currently resolves to the same numeric value as `primary` in both light and dark themes, so today it is a semantic alias rather than a distinct hue.",
        swatches: [
            { label: "primary", className: "bg-primary text-primary-foreground", example: "Primary CTAs and active wizard steps." },
            { label: "brand-deep", className: "bg-brand-deep text-primary-foreground", example: "Candidate-session reassurance banner." },
            { label: "state-info", className: "bg-state-info text-primary-foreground", example: "Dashboard stats, progress badges, and info callouts." },
        ],
    },
    {
        name: "Support",
        usage: "Quiet surfaces, separators, and informational chrome. `muted` is active across tables, placeholders, inactive nav states, empty states, and low-emphasis form shells.",
        swatches: [
            { label: "surface-base", className: "bg-surface-base text-text-primary border border-border", example: "Default cards, modals, and page surfaces." },
            { label: "surface-subtle", className: "bg-surface-subtle text-text-primary border border-border", example: "Quiet panels, step rails, and separators." },
            { label: "muted", className: "bg-muted text-muted-foreground", example: "Table headers, skeletons, placeholders, and inactive utility states." },
        ],
    },
    {
        name: "Status",
        usage: "Success, warning, and critical messaging and indicators. These semantic tokens are live in dashboards, badges, alert recipes, and recruiter/session workflows.",
        swatches: [
            { label: "state-success", className: "bg-state-success text-white", example: "Saved states, completion badges, and positive stats." },
            { label: "state-warning", className: "bg-state-warning text-warning-foreground", example: "Template/question caution chips and intermediate status." },
            { label: "state-critical", className: "bg-state-critical text-white", example: "Error panels, destructive actions, and blocking alerts." },
        ],
    },
]

const typeScale = [
    { label: "Display", className: "font-display text-4xl font-black", sample: "Design System" },
    { label: "Page Title", className: "text-3xl font-bold", sample: "Recruiter Dashboard" },
    { label: "Section Title", className: "text-xl font-bold", sample: "Manage Invites" },
    { label: "Body Large", className: "text-lg", sample: "Systematic interface decisions improve trust and speed." },
    { label: "Body Default", className: "text-base text-text-primary", sample: "Use this for normal explanatory copy." },
    { label: "Label / Chrome", className: "text-micro font-bold uppercase tracking-widest text-text-muted", sample: "Primary metadata" },
]

const utilityRecipes = [
    {
        title: "Input shell",
        className: "rounded-xl border border-border bg-surface-subtle px-4 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20",
        note: "Default form control surface.",
    },
    {
        title: "App card",
        className: "rounded-2xl border border-border/50 bg-surface-base shadow-raised-1",
        note: "Default product container.",
    },
    {
        title: "Section divider",
        className: "border-t border-border/30 pt-8",
        note: "Standard footer or section separation.",
    },
    {
        title: "Alert panel",
        className: "rounded-2xl border px-4 py-3 text-sm font-medium",
        note: "Shared app messaging surface for success, info, warning, and critical states.",
    },
]

const hierarchyRules = [
    {
        title: "Page",
        body: "One title, one short descriptor, one primary action zone. Summary context follows the header, not inside it.",
    },
    {
        title: "Section",
        body: "Each section should explain purpose before exposing controls. Title, description, then actions.",
    },
    {
        title: "Card",
        body: "Lead with content identity. Controls belong in the header edge or footer, not competing with core content.",
    },
    {
        title: "Modal",
        body: "Header introduces the task, body holds the decision context, footer holds the peripheral trust/support text. Avoid mixing different action hierarchies unless the state truly changes.",
    },
]

function GuideCard({
    eyebrow,
    title,
    description,
    children,
}: {
    eyebrow: string
    title: string
    description: string
    children: React.ReactNode
}) {
    return (
        <Card className="overflow-hidden rounded-3xl border-border/60 shadow-raised-1">
            <CardHeader className="border-b border-border/40 bg-surface-subtle/40">
                <p className="text-micro font-bold uppercase tracking-widest text-text-muted">{eyebrow}</p>
                <CardTitle>{title}</CardTitle>
                <CardDescription className="italic">{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6 md:p-8">{children}</CardContent>
        </Card>
    )
}

export function ComponentGallery() {
    return (
        <div className="space-y-12 pb-20">
            <SectionHeader
                title="Design Style Guide"
                description="Living reference for the app's visual system: tokens, typography, buttons, blocks, components, and hierarchy rules grounded in real UI."
                size="lg"
            />

            <GuideCard
                eyebrow="Purpose"
                title="What This Page Should Become"
                description="This page should be the living reference surface for normalization work across recruiter, admin, session, and email UI."
            >
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-surface-base p-5 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Foundations</p>
                        <h3 className="mt-3 text-lg font-bold text-text-primary">Tokens and scales</h3>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Color, typography, radius, elevation, and motion need one reference point.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-surface-base p-5 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Patterns</p>
                        <h3 className="mt-3 text-lg font-bold text-text-primary">Canonical components</h3>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Buttons, cards, alerts, fields, and action groups should be previewed here in live form.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-surface-base p-5 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Hierarchy</p>
                        <h3 className="mt-3 text-lg font-bold text-text-primary">Layout and blocks</h3>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Page shells, modal headers, wizard steps, and email CTAs need consistent structure, not just consistent buttons.
                        </p>
                    </div>
                </div>
            </GuideCard>

            <GuideCard
                eyebrow="Foundations"
                title="Color Palette"
                description="These are the semantic families the interface should compose from. New surfaces should reuse these before inventing new hues."
            >
                <div className="grid gap-6 xl:grid-cols-3">
                    {colorFamilies.map((family) => (
                        <div key={family.name} className="rounded-3xl border border-border/60 bg-surface-base p-5 shadow-flat">
                            <h3 className="text-xl font-bold text-text-primary">{family.name}</h3>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">{family.usage}</p>
                            <div className="mt-5 space-y-3">
                                {family.swatches.map((swatch) => (
                                    <div key={swatch.label} className="flex items-center gap-3">
                                        <div className={`h-12 w-12 rounded-xl ${swatch.className} shadow-flat`} />
                                        <div>
                                            <p className="text-sm font-bold text-text-primary">{swatch.label}</p>
                                            <p className="text-xs text-text-muted">{swatch.example}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </GuideCard>

            <GuideCard
                eyebrow="Foundations"
                title="Typography"
                description="Type should express hierarchy clearly before layout, color, or ornament try to do that work."
            >
                <div className="grid gap-5 lg:grid-cols-2">
                    {typeScale.map((item) => (
                        <div key={item.label} className="rounded-3xl border border-border/60 bg-surface-base p-5 shadow-flat">
                            <p className="text-micro font-bold uppercase tracking-widest text-text-muted">{item.label}</p>
                            <div className={`mt-4 ${item.className}`}>{item.sample}</div>
                        </div>
                    ))}
                </div>
            </GuideCard>

            <GuideCard
                eyebrow="Tokens"
                title="Radius, Elevation, And Motion"
                description="These need to be evaluated in the context of real component scale and behavior, not as isolated token chips."
            >
                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="rounded-3xl border border-border/60 bg-surface-base p-5 shadow-flat">
                        <h3 className="text-lg font-bold text-text-primary">Radius In Context</h3>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-xl border border-border/60 bg-surface-subtle/40 p-4">
                                <p className="text-micro font-bold uppercase tracking-widest text-text-muted">rounded-xl</p>
                                <div className="mt-3 flex items-center gap-3">
                                    <Button emphasis="secondary" density="compact" shape="square" label="strong">Send</Button>
                                    <p className="text-sm leading-6 text-text-secondary">Compact modal action buttons and email CTAs.</p>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-surface-subtle/40 p-4">
                                <p className="text-micro font-bold uppercase tracking-widest text-text-muted">rounded-2xl</p>
                                <div className="mt-3 flex items-center gap-3">
                                    <Button emphasis="primary" density="comfortable" shape="app" label="strong">New Invite</Button>
                                    <p className="text-sm leading-6 text-text-secondary">Default app CTA and repeated alert-panel shell radius.</p>
                                </div>
                            </div>
                            <div className="rounded-full border border-border/60 bg-surface-subtle/40 p-4">
                                <p className="text-micro font-bold uppercase tracking-widest text-text-muted">rounded-full</p>
                                <div className="mt-3 flex items-center gap-3">
                                    <StatusBadge variant="success">Shared</StatusBadge>
                                    <p className="text-sm leading-6 text-text-secondary">Pill status and chrome treatments only.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-5 shadow-flat">
                        <h3 className="text-lg font-bold text-text-primary">Elevation By Surface Layer</h3>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-border/60 bg-surface-base p-4 shadow-flat">
                                <p className="text-sm font-semibold text-text-primary">`shadow-flat`</p>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">Icon chips, quiet badges, and low-emphasis shells that need edge definition without lift.</p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-surface-base p-4 shadow-raised-1">
                                <p className="text-sm font-semibold text-text-primary">`shadow-raised-1`</p>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">Default cards and primary buttons. This is the app’s standard interactive lift.</p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-surface-base p-4 shadow-raised-2">
                                <p className="text-sm font-semibold text-text-primary">`shadow-raised-2`</p>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">Hover-intensified cards and promoted actions that need stronger separation.</p>
                            </div>
                            <div className="rounded-[32px] border border-border/60 bg-surface-base p-4 shadow-floating">
                                <p className="text-sm font-semibold text-text-primary">`shadow-floating`</p>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">Modal and dialog surfaces like the invite preview, where the whole layer lifts above the app.</p>
                            </div>
                            <SessionPromptShell className="bg-surface-base/90">
                                <p className="text-sm font-semibold text-text-primary">Session prompt shell</p>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">A quiet glass surface for the live question prompt. It sits between a normal card and a modal layer: elevated enough to focus attention, restrained enough to keep the workspace calm.</p>
                            </SessionPromptShell>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-5 shadow-flat">
                        <h3 className="text-lg font-bold text-text-primary">Motion Usage Patterns</h3>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-border/60 bg-surface-subtle/40 p-4">
                                <p className="text-sm font-semibold text-text-primary">Micro interaction</p>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">Buttons and cards use `transition-all duration-base ease-standard` for hover, focus, and pressed states. The point is responsive tactility, not spectacle.</p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-surface-subtle/40 p-4">
                                <p className="text-sm font-semibold text-text-primary">Entrance cues</p>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">Alerts, lists, and wizard content use `animate-in` with short `fade-in` and directional `slide-in` classes to acknowledge state changes without stealing focus.</p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-surface-subtle/40 p-4">
                                <p className="text-sm font-semibold text-text-primary">Overlays and modals</p>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">Dialogs combine backdrop blur, fade, and a slight zoom so the context recedes and the task surface feels elevated and intentional.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </GuideCard>

            <GuideCard
                eyebrow="Classes"
                title="Canonical Utility Recipes"
                description="These are the recurring class recipes worth treating as intentional patterns when building new surfaces."
            >
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {utilityRecipes.map((recipe) => (
                        <div key={recipe.title} className="rounded-3xl border border-border/60 bg-surface-base p-5 shadow-flat">
                            <h3 className="text-lg font-bold text-text-primary">{recipe.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">{recipe.note}</p>
                            <code className="mt-4 block rounded-2xl bg-surface-subtle/60 p-4 text-sm leading-6 text-text-secondary">
                                {recipe.className}
                            </code>
                        </div>
                    ))}
                </div>
            </GuideCard>

            <GuideCard
                eyebrow="Buttons"
                title="Canonical Button System"
                description="The shared Button API should now be the default grammar for actions across the app."
            >
                <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Primary and secondary</p>
                        <div className="mt-5 flex flex-wrap gap-3">
                            <Button emphasis="primary" density="comfortable" shape="app" label="strong">
                                <Plus className="mr-2 h-4 w-4" />
                                New Invite
                            </Button>
                            <Button emphasis="secondary" density="comfortable" shape="app" label="strong">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Go to Dashboard
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Tertiary, danger, utility</p>
                        <div className="mt-5 flex flex-wrap gap-3">
                            <Button emphasis="tertiary" density="default" shape="app" label="strong">
                                Use Template
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                            <Button emphasis="danger" density="comfortable" shape="app" label="strong">
                                Delete
                            </Button>
                            <Button variant="ghost" size="icon" shape="square" className="text-text-muted">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Hero and chrome</p>
                        <div className="mt-5 flex flex-wrap gap-3">
                            <Button emphasis="primary" density="hero" shape="app" label="strong">
                                Continue to Next Question
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                            <Button emphasis="secondary" density="compact" shape="pill" label="chrome" className="border-state-info/20 bg-state-info/10 text-state-info hover:bg-state-info/20">
                                Demo Action
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Inline actions</p>
                        <div className="mt-5 flex flex-wrap items-center gap-5">
                            <button className="inline-flex items-center gap-2 text-sm font-bold text-text-muted transition-colors hover:text-primary">
                                <RotateCcw className="h-4 w-4" />
                                Retry my answer
                            </button>
                            <Button variant="link">View full details</Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-slate-950 p-5 shadow-floating">
                    <p className="text-micro font-bold uppercase tracking-widest text-slate-400">Preferred API</p>
                    <code className="mt-3 block whitespace-pre-wrap text-sm leading-6 text-slate-100">
                        {`<Button emphasis="primary" density="comfortable" shape="app" label="strong" />
<Button emphasis="secondary" density="comfortable" shape="app" label="strong" />
<Button emphasis="tertiary" density="default" shape="app" label="strong" />
<Button variant="ghost" size="icon" shape="square" />
<Button emphasis="secondary" density="compact" shape="pill" label="chrome" />`}
                    </code>
                </div>
            </GuideCard>

            <GuideCard
                eyebrow="Components"
                title="Status, Messaging, And Search Patterns"
                description="This section covers the current shared primitives for app messaging, search, and session feedback controls."
            >
                <div className="grid gap-6 xl:grid-cols-3">
                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Primitive badges</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <Badge variant="success">Success</Badge>
                            <Badge variant="warning">Warning</Badge>
                            <Badge variant="info">Info</Badge>
                            <Badge variant="destructive">Critical</Badge>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Semantic badges</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <StatusBadge variant="success">Complete</StatusBadge>
                            <StatusBadge variant="warning">Needs review</StatusBadge>
                            <StatusBadge variant="info">In progress</StatusBadge>
                            <StatusBadge variant="critical">Blocked</StatusBadge>
                        </div>
                    </div>

                    <FeedbackPanel
                        title="Shared assessment panel"
                        body="`FeedbackPanel` exists as a real reusable pattern for richer semantic commentary."
                        assessment="satisfactory"
                        className="rounded-3xl border-border/60 shadow-flat"
                    />

                    <AlertPanel tone="success" icon className="shadow-flat">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">Shared alert panel</p>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">This repeated recipe now has a shared implementation for app messaging surfaces.</p>
                        </div>
                    </AlertPanel>

                    <AlertPanel tone="critical" icon className="shadow-flat">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">Critical alert panel</p>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">Used for blocking and error messaging where the app needs immediate but compact feedback.</p>
                        </div>
                    </AlertPanel>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat xl:col-span-2">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Search input</p>
                        <div className="mt-4 max-w-md">
                            <SearchField readOnly value="" placeholder="Search by template name or role..." />
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Info callout recipe</p>
                        <div className="mt-4 rounded-xl border-l-4 border-state-info/50 bg-state-info/5 p-4">
                            <div className="flex items-start gap-3">
                                <Info className="mt-0.5 h-5 w-5 shrink-0 text-state-info" />
                                <p className="text-sm leading-6 text-text-secondary">
                                    This pattern exists in the candidate landing flow. It is an implemented recipe, not yet a shared `InfoBlock` primitive.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat xl:col-span-2">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Session feedback choices</p>
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                            <FeedbackChoiceButton kind="emoji" tone="primary" selected>
                                🙂
                            </FeedbackChoiceButton>
                            <FeedbackChoiceButton kind="chip" tone="success" selected>
                                Yes
                            </FeedbackChoiceButton>
                            <FeedbackChoiceButton kind="chip" tone="neutral">
                                No
                            </FeedbackChoiceButton>
                            <FeedbackChoiceButton kind="compact" tone="primary">
                                Somewhat
                            </FeedbackChoiceButton>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-text-secondary">
                            `FeedbackChoiceButton` now powers the landing-screen preparedness baseline, the session survey, and the helpfulness controls in the feedback drawer.
                        </p>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-flat">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Session insight cards</p>
                        <div className="mt-4 space-y-3">
                            <InsightCard tone="positive">
                                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">What to Aim For</p>
                                <p className="mt-2 text-sm leading-6 text-emerald-900">Lead with one concrete example, then explain why it mattered.</p>
                            </InsightCard>
                            <InsightCard tone="highlight">
                                <p className="text-xs font-bold uppercase tracking-wider text-purple-700">Example Strong Response</p>
                                <p className="mt-2 text-sm leading-6 text-text-primary">I prioritized clarifying the customer problem first so the solution stayed tied to the actual decision risk.</p>
                            </InsightCard>
                        </div>
                    </div>
                </div>
            </GuideCard>

            <GuideCard
                eyebrow="Blocks"
                title="Canonical Layout Blocks"
                description="These are the larger UI compositions that should repeat across the app with minimal variation."
            >
                <div className="space-y-8">
                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-raised-1">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Page header block</p>
                        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-2">
                                <h2 className="text-3xl font-bold text-text-primary">Interview Templates</h2>
                                <p className="text-sm italic text-text-muted">Manage and reuse your question sets for consistent interviews.</p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Button emphasis="secondary" density="comfortable" shape="app" label="strong">
                                    View Templates
                                </Button>
                                <Button emphasis="primary" density="comfortable" shape="app" label="strong">
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Template
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-raised-1">
                        <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Wizard footer block</p>
                        <div className="mt-5 border-t border-border/30 pt-8">
                            <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <Button emphasis="secondary" density="comfortable" shape="app" label="strong">
                                    <ChevronLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                                    <Button emphasis="secondary" density="comfortable" shape="app" label="strong">
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Template
                                    </Button>
                                    <Button emphasis="primary" density="comfortable" shape="app" label="strong">
                                        Next: Add Candidates
                                        <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-raised-1">
                            <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Elevated content card</p>
                            <div className="mt-5">
                                <ContentCard density="spacious" className="w-full">
                                    <div className="border-b border-border/60 pb-4">
                                        <h3 className="text-2xl font-bold text-text-primary">Session summary card</h3>
                                        <p className="mt-2 text-sm italic text-text-muted">Used for end-of-session debrief sections and other high-emphasis reading surfaces.</p>
                                    </div>
                                    <p className="mt-5 text-base leading-7 text-text-secondary">
                                        This shell now backs the session summary and loading skeleton surfaces so large narrative content stops reimplementing its own radius, padding, and elevation recipe.
                                    </p>
                                </ContentCard>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-raised-1">
                            <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Session prompt block</p>
                            <div className="mt-5">
                                <SessionPromptShell
                                    footer={
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex gap-3">
                                                <Button density="compact" shape="square" label="strong" className="border border-state-info/20 bg-state-info/10 text-state-info">
                                                    Hints
                                                </Button>
                                                <Button density="compact" shape="square" label="strong" className="border border-accent-alt/20 bg-accent-alt/10 text-accent-alt">
                                                    Example
                                                </Button>
                                            </div>
                                            <Button size="icon" shape="pill" className="bg-surface-subtle/50 text-state-info border border-border/50">
                                                <PlayCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    }
                                >
                                    <p className="mb-6 inline-flex items-center rounded-full bg-brand-deep px-3 py-1 text-micro font-bold uppercase tracking-wider text-text-inverse">Behavioral</p>
                                    <h3 className="text-2xl font-bold text-text-primary">Tell me about a time you had to handle competing priorities under pressure.</h3>
                                </SessionPromptShell>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-text-secondary">
                                This is now the canonical live-question shell in the session flow: quiet glass body, restrained category chip, and a dedicated action rail.
                            </p>
                        </div>

                        <div className="rounded-3xl border border-border/60 bg-surface-base p-6 shadow-raised-1">
                            <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Modal action header</p>
                            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-surface-base/90 px-4 py-3 backdrop-blur-sm">
                                <p className="text-[13px] font-medium leading-tight text-text-secondary">
                                    Verify and click <strong>Send</strong> or <strong>Cancel</strong> to edit.
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button emphasis="secondary" density="compact" shape="square" label="strong">
                                        Cancel
                                    </Button>
                                    <Button emphasis="primary" density="compact" shape="square" label="strong">
                                        <SendHorizontal className="mr-2 h-4 w-4" />
                                        Send
                                    </Button>
                                    <Button variant="ghost" size="icon" shape="pill" aria-label="Close preview">
                                        <X className="h-4 w-4 text-text-secondary" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-border/60 bg-white p-6 shadow-raised-1">
                            <p className="text-micro font-bold uppercase tracking-widest text-text-muted">Recommended email CTAs</p>
                            <div className="mt-5 flex flex-wrap gap-4">
                                <button className="inline-flex items-center gap-3 rounded-xl bg-primary px-8 py-4 text-[15px] font-bold text-primary-foreground shadow-raised-1">
                                    <PlayCircle className="h-4 w-4" />
                                    Start My Practice Session
                                </button>
                                <button className="inline-flex items-center gap-3 rounded-xl bg-primary px-9 py-4 text-base font-bold text-primary-foreground shadow-raised-1">
                                    <FileText className="h-4 w-4" />
                                    View Your Full Debrief
                                </button>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-text-secondary">
                                The live invite and debrief templates both use a `12px` radius. The debrief CTA only reads optically tighter because the button is wider, not because the radius token is different.
                            </p>
                        </div>
                    </div>
                </div>
            </GuideCard>

            <GuideCard
                eyebrow="Hierarchy"
                title="Layout And Component Hierarchy Rules"
                description="Normalizing the app means normalizing how surfaces are composed, not just how individual controls are styled."
            >
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {hierarchyRules.map((rule) => (
                        <div key={rule.title} className="rounded-3xl border border-border/60 bg-surface-base p-5 shadow-flat">
                            <h3 className="text-lg font-bold text-text-primary">{rule.title}</h3>
                            <p className="mt-3 text-sm leading-7 text-text-secondary">{rule.body}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-3xl border border-border/60 bg-slate-950 p-6 shadow-floating">
                    <p className="text-micro font-bold uppercase tracking-widest text-slate-400">Normalization order</p>
                    <div className="mt-5 space-y-3 text-sm leading-7 text-slate-100">
                        <p><strong>1.</strong> Lock the foundations: palette, type, radius, shadows, motion.</p>
                        <p><strong>2.</strong> Keep expanding canonical action patterns and page-header structures.</p>
                        <p><strong>3.</strong> Normalize form shells, alerts, card headers, and modal action headers.</p>
                        <p><strong>4.</strong> Normalize full blocks like tables, wizard steps, summary cards, and emails.</p>
                        <p><strong>5.</strong> Remove one-off styling once each replacement block exists here.</p>
                    </div>
                </div>
            </GuideCard>
        </div>
    )
}

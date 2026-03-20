import { Button } from "@/components/ui/button"
import { ContentCard } from "@/components/patterns/ContentCard"

export default function ErrorScreen() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <ContentCard density="hero" align="center" className="w-full max-w-md space-y-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-destructive">Something went wrong</h2>
                    <p className="text-muted-foreground">We couldn&apos;t load your session.</p>
                </div>
                <Button emphasis="secondary" density="comfortable" shape="app" label="strong" onClick={() => window.location.reload()}>
                    Try Again
                </Button>
            </ContentCard>
        </div>
    )
}

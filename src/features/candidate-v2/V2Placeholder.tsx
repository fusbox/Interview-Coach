type V2PlaceholderProps = {
    title: string;
    description: string;
};

export function V2Placeholder({ title, description }: V2PlaceholderProps) {
    return (
        <main className="candidate-design-system min-h-screen bg-[rgb(var(--candidate-background))] px-6 py-10 text-[rgb(var(--candidate-foreground))]">
            <section className="mx-auto max-w-3xl rounded-[2rem] border border-[rgb(var(--candidate-border)/0.75)] bg-white p-8 shadow-[0_18px_45px_rgba(15,33,57,0.08)]">
                <p className="eyebrow mb-3">Candidate V2</p>
                <h1 className="font-display text-3xl font-bold">{title}</h1>
                <p className="mt-4 text-sm leading-6 text-[rgb(var(--candidate-muted))]">{description}</p>
            </section>
        </main>
    );
}

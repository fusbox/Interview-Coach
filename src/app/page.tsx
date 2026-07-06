export default function HomePage() {
    return (
        <main className="candidate-design-system flex min-h-screen items-center justify-center px-6 py-12">
            <section className="w-full max-w-2xl rounded-2xl border border-[rgb(var(--candidate-border))] bg-white p-8 shadow-sm">
                <p className="eyebrow">Candidate V2</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight">Cleanroom scaffold</h1>
                <p className="mt-4 text-sm leading-6 text-[rgb(var(--candidate-muted))]">
                    This branch intentionally starts from a minimal app shell. Candidate V2 code will be brought in slice by slice as the rebuild requires it.
                </p>
            </section>
        </main>
    );
}

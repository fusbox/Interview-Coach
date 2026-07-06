type V2RouteShellProps = {
    title: string;
    description: string;
};

export function V2RouteShell({ title, description }: V2RouteShellProps) {
    return (
        <main className="candidate-design-system flex min-h-screen items-center justify-center px-6 py-12">
            <section className="w-full max-w-2xl rounded-2xl border border-[rgb(var(--candidate-border))] bg-white p-8 shadow-sm">
                <p className="eyebrow">Candidate V2</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
                <p className="mt-4 text-sm leading-6 text-[rgb(var(--candidate-muted))]">{description}</p>
            </section>
        </main>
    );
}

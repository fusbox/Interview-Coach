import { candidateV2DesignSystem as v2ds } from "./design-system";

type V2PlaceholderProps = {
    title: string;
    description: string;
};

export function V2Placeholder({ title, description }: V2PlaceholderProps) {
    return (
        <main className={v2ds.classNames.page}>
            <section className={v2ds.classNames.panel}>
                <p className={v2ds.classNames.eyebrow}>Candidate V2</p>
                <h1 className={v2ds.classNames.title}>{title}</h1>
                <p className={v2ds.classNames.body}>{description}</p>
            </section>
        </main>
    );
}

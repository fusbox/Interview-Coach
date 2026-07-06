import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
    title: "Interview Coach | TalentArbor",
    description: "AI-guided interview practice for job seekers preparing for their next opportunity.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}

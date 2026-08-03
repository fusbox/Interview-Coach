import type { Metadata } from "next";
import "../../design-system/styles.css";
import "../index.css";

import { CANDIDATE_THEME_STORAGE_KEY } from "@/features/candidate-v2/candidate-theme";

export const metadata: Metadata = {
    title: "Interview Coach | TalentArbor",
    description: "AI-guided interview practice for job seekers preparing for their next opportunity.",
};

const themeBootstrapScript = `(() => {
    try {
        const theme = window.localStorage.getItem(${JSON.stringify(CANDIDATE_THEME_STORAGE_KEY)}) === "dark"
            ? "dark"
            : "light";
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
    } catch {
        document.documentElement.dataset.theme = "light";
        document.documentElement.style.colorScheme = "light";
    }
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
            </head>
            <body>{children}</body>
        </html>
    );
}

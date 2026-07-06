import type { Metadata } from "next";
import "../index.css";

export const metadata: Metadata = {
    title: "Interview Coach V2",
    description: "Cleanroom scaffold for the Interview Coach candidate V2 rebuild.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}

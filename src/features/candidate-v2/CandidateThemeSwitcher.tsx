"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import {
    CANDIDATE_THEME_STORAGE_KEY,
    normalizeCandidateTheme,
    type CandidateTheme,
} from "./candidate-theme";

const CANDIDATE_THEME_CHANGE_EVENT = "interview-coach:theme-change";

export function CandidateThemeSwitcher({ className }: { className?: string }) {
    const [theme, setTheme] = useState<CandidateTheme | null>(null);
    const currentTheme = theme ?? "light";
    const nextTheme = currentTheme === "light" ? "dark" : "light";

    useEffect(() => {
        const syncFromDocument = () => {
            setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
        };
        const syncFromStorage = (event: StorageEvent) => {
            if (event.key !== CANDIDATE_THEME_STORAGE_KEY) return;
            const storedTheme = normalizeCandidateTheme(event.newValue);
            applyCandidateTheme(storedTheme);
            setTheme(storedTheme);
        };

        syncFromDocument();
        window.addEventListener("storage", syncFromStorage);
        window.addEventListener(CANDIDATE_THEME_CHANGE_EVENT, syncFromDocument);
        return () => {
            window.removeEventListener("storage", syncFromStorage);
            window.removeEventListener(CANDIDATE_THEME_CHANGE_EVENT, syncFromDocument);
        };
    }, []);

    function toggleTheme() {
        applyCandidateTheme(nextTheme);
        try {
            window.localStorage.setItem(CANDIDATE_THEME_STORAGE_KEY, nextTheme);
        } catch {
            // Theme remains usable when browser persistence is unavailable.
        }
        setTheme(nextTheme);
        window.dispatchEvent(new Event(CANDIDATE_THEME_CHANGE_EVENT));
    }

    return (
        <button
            type="button"
            className={`candidate-theme-switcher${className ? ` ${className}` : ""}`}
            data-theme={currentTheme}
            aria-label={`Switch to ${nextTheme} theme`}
            title={`Switch to ${nextTheme} theme`}
            onClick={toggleTheme}
        >
            <span
                className={`candidate-theme-switcher__option${currentTheme === "light" ? " is-active" : ""}`}
                data-active={currentTheme === "light"}
                aria-hidden="true"
            >
                <Sun size={15} strokeWidth={2.2} />
            </span>
            <span
                className={`candidate-theme-switcher__option${currentTheme === "dark" ? " is-active" : ""}`}
                data-active={currentTheme === "dark"}
                aria-hidden="true"
            >
                <Moon size={15} strokeWidth={2.2} />
            </span>
        </button>
    );
}

function applyCandidateTheme(theme: CandidateTheme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
}

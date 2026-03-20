import { RefObject, useEffect, useRef } from "react";

type UseAccessibleDialogOptions = {
    isOpen: boolean;
    containerRef: RefObject<HTMLElement | null>;
    initialFocusRef?: RefObject<HTMLElement | null>;
    onClose?: () => void;
};

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useAccessibleDialog({
    isOpen,
    containerRef,
    initialFocusRef,
    onClose,
}: UseAccessibleDialogOptions) {
    const previousFocusedElementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            previousFocusedElementRef.current?.focus();
            previousFocusedElementRef.current = null;
            return;
        }

        previousFocusedElementRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        const focusTarget = initialFocusRef?.current ?? containerRef.current;
        focusTarget?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && onClose) {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== "Tab" || !containerRef.current) {
                return;
            }

            const focusableElements = Array.from(
                containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");

            if (focusableElements.length === 0) {
                event.preventDefault();
                containerRef.current.focus();
                return;
            }

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

            if (event.shiftKey && activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
                return;
            }

            if (!event.shiftKey && activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [containerRef, initialFocusRef, isOpen, onClose]);
}

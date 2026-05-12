type AccessibilityViolation = {
    message: string;
};

export function getBasicAccessibilityViolations(root: ParentNode): AccessibilityViolation[] {
    const violations: AccessibilityViolation[] = [];
    const mains = Array.from(root.querySelectorAll("main"));
    const headings = Array.from(root.querySelectorAll("h1"));

    if (mains.length !== 1) {
        violations.push({ message: `Expected exactly one main landmark, found ${mains.length}.` });
    }

    if (headings.length !== 1) {
        violations.push({ message: `Expected exactly one h1, found ${headings.length}.` });
    }

    for (const image of Array.from(root.querySelectorAll("img"))) {
        if (!image.hasAttribute("alt")) {
            violations.push({ message: `Image is missing alt text: ${describeElement(image)}.` });
        }
    }

    for (const control of Array.from(root.querySelectorAll("a[href], button, input, select, textarea"))) {
        if (!hasAccessibleName(control)) {
            violations.push({ message: `Interactive control is missing an accessible name: ${describeElement(control)}.` });
        }
    }

    return violations;
}

function hasAccessibleName(element: Element) {
    const text = element.textContent?.trim();
    if (text) return true;

    if (element.getAttribute("aria-label")?.trim()) return true;
    if (element.getAttribute("aria-labelledby")?.trim()) return true;
    if (element.getAttribute("title")?.trim()) return true;

    if (
        element instanceof HTMLInputElement
        || element instanceof HTMLSelectElement
        || element instanceof HTMLTextAreaElement
    ) {
        return (element.labels?.length ?? 0) > 0;
    }

    return false;
}

function describeElement(element: Element) {
    const clone = element.cloneNode(false) as Element;
    return clone.outerHTML;
}

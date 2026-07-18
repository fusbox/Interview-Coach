import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
    if (!window.matchMedia) {
        Object.defineProperty(window, "matchMedia", {
            writable: true,
            value: (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: () => undefined,
                removeListener: () => undefined,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
                dispatchEvent: () => false,
            }),
        });
    }

    if (!window.ResizeObserver) {
        class ResizeObserverMock {
            observe() { return undefined; }
            unobserve() { return undefined; }
            disconnect() { return undefined; }
        }
        Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverMock });
    }

    if (!window.IntersectionObserver) {
        class IntersectionObserverMock {
            readonly root = null;
            readonly rootMargin = "";
            readonly thresholds = [];
            observe() { return undefined; }
            unobserve() { return undefined; }
            disconnect() { return undefined; }
            takeRecords() { return []; }
        }
        Object.defineProperty(window, "IntersectionObserver", { writable: true, value: IntersectionObserverMock });
    }

    Object.defineProperties(HTMLElement.prototype, {
        offsetHeight: { configurable: true, get: () => 100 },
        offsetLeft: {
            configurable: true,
            get() {
                return this.parentElement ? Array.from(this.parentElement.children).indexOf(this) * 100 : 0;
            },
        },
        offsetTop: { configurable: true, get: () => 0 },
        offsetWidth: { configurable: true, get: () => 100 },
    });
}

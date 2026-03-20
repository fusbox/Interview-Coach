import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadJson } from './export-utils';

describe('downloadJson', () => {
    const createObjectURL = vi.fn(() => 'blob:test-download');
    const revokeObjectURL = vi.fn();

    afterEach(() => {
        vi.restoreAllMocks();
        createObjectURL.mockClear();
        revokeObjectURL.mockClear();
    });

    it('sanitizes the filename and uses a blob URL download', () => {
        vi.stubGlobal('URL', {
            createObjectURL,
            revokeObjectURL,
        });

        const anchor = document.createElement('a');
        const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
        const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
        const appendSpy = vi.spyOn(document.body, 'appendChild');
        const removeSpy = vi.spyOn(document.body, 'removeChild');

        downloadJson({ candidateName: '<img src=x onerror=alert(1)>' }, '../Unsafe Export<>');

        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(anchor.href).toBe('blob:test-download');
        expect(anchor.download).toBe('Unsafe-Export.json');
        expect(anchor.rel).toBe('noopener');
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(appendSpy).toHaveBeenCalledWith(anchor);
        expect(removeSpy).toHaveBeenCalledWith(anchor);
        expect(createObjectURL).toHaveBeenCalledOnce();
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-download');
    });

    it('rejects unexpected URL schemes', () => {
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'javascript:alert(1)'),
            revokeObjectURL,
        });

        expect(() => downloadJson({ ok: true }, 'export.json')).toThrow('Unexpected download URL scheme.');
    });
});

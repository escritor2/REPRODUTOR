import { describe, it, expect } from 'vitest';
import { fmtTime } from '../js/ui.js';

describe('Format Time Utilities', () => {
    it('should format seconds to MM:SS', () => {
        expect(fmtTime(65)).toBe('1:05');
        expect(fmtTime(120)).toBe('2:00');
        expect(fmtTime(3599)).toBe('59:59');
    });

    it('should handle zero and negative values gracefully', () => {
        expect(fmtTime(0)).toBe('0:00');
        expect(fmtTime(null)).toBe('0:00');
        expect(fmtTime(undefined)).toBe('0:00');
        expect(fmtTime(NaN)).toBe('0:00');
    });
});

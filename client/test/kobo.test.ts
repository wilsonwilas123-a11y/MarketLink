import { describe, it, expect } from 'vitest';
import { formatKobo } from '../src/utils/kobo';

describe('formatKobo', () => {
  it('renders whole naira without decimals', () => {
    expect(formatKobo(250000)).toBe('₦2,500');
    expect(formatKobo(11200000)).toBe('₦112,000');
    expect(formatKobo(0)).toBe('₦0');
  });

  it('keeps the kobo remainder instead of rounding it away', () => {
    expect(formatKobo(2550)).toBe('₦25.50');
    expect(formatKobo(5)).toBe('₦0.05');
  });
});

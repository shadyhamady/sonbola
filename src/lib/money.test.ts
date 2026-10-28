import { describe, expect, it } from 'vitest';
import { formatMoney, toMilli } from './money';

describe('money', () => {
  it('formats with the configured decimals and symbol', () => {
    expect(formatMoney(2500, { symbol: 'د.ك', decimals: 3 })).toBe('2.500 د.ك');
    expect(formatMoney(1234500, { symbol: 'ر.س', decimals: 2 })).toBe('1,234.50 ر.س');
    expect(formatMoney(7000, { symbol: 'د.إ', decimals: 0 })).toBe('7 د.إ');
  });

  it('converts major units to milli without float drift', () => {
    expect(toMilli(2.75)).toBe(2750);
  });
});

export interface MoneyFormat {
  symbol: string;
  decimals: number;
}

export const toMilli = (v: number) => Math.round(v * 1000);
export const fromMilli = (m: number) => m / 1000;

export function formatMoney(milli: number, { symbol, decimals }: MoneyFormat): string {
  const n = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(milli / 1000);
  return symbol ? `${n} ${symbol}` : n;
}

const qtyFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
export const formatQty = (n: number) => qtyFormat.format(n);

const pctFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** `f` is a fraction: 0.125 → "12.5%". */
export const formatPct = (f: number) => `${pctFormat.format(f * 100)}%`;

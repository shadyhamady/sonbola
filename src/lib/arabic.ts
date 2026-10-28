/** "n فاتورة" with correct Arabic number agreement (1 → فاتورة واحدة, 2 → فاتورتان, 3–10 → فواتير). */
export function invoiceCount(n: number): string {
  if (n === 0) return 'بدون فواتير';
  if (n === 1) return 'فاتورة واحدة';
  if (n === 2) return 'فاتورتان';
  if (n % 100 >= 3 && n % 100 <= 10) return `${n} فواتير`;
  return `${n} فاتورة`;
}

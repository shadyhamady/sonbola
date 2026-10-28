import type { AdjReason, Method, PayMode, PayType, PurchaseStatus, StockStatus, Unit } from './types';

export const UNIT_LABELS: Record<Unit, string> = {
  kg: 'كغ',
  g: 'غ',
  l: 'لتر',
  ml: 'مل',
  pcs: 'حبة',
  pack: 'عبوة',
  tray: 'صينية',
};

export const METHOD_LABELS: Record<Method, string> = {
  cash: 'نقداً',
  card: 'بطاقة',
  bank_transfer: 'تحويل بنكي',
  other: 'أخرى',
};

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  monthly: 'شهري',
  weekly: 'أسبوعي',
  daily: 'يومي',
  hourly: 'بالساعة',
  production: 'بالإنتاج',
};

export const PAY_MODE_LABELS: Record<PayMode, string> = {
  none: 'بدون',
  per_unit: 'بالقطعة',
  per_kg: 'بالكيلو',
  per_batch: 'بالدفعة',
};

/** Unit of a production worker's pay basis, by product pay mode. */
export const PAY_BASIS_UNIT: Record<PayMode, string> = {
  none: '',
  per_unit: 'قطعة',
  per_kg: 'كغ',
  per_batch: 'دفعة',
};

export const ADJ_REASON_LABELS: Record<AdjReason, string> = {
  waste: 'هدر / تلف',
  count: 'تصحيح جرد',
  returned: 'مرتجع للمورد',
  outside_use: 'استخدام خارج الوصفات',
  other: 'أخرى',
};

export const STOCK_STATUS: Record<StockStatus, { label: string; color: string }> = {
  out: { label: 'نفد', color: 'red' },
  reorder: { label: 'أعد الطلب', color: 'orange' },
  ok: { label: 'متوفر', color: 'green' },
};

export const PURCHASE_STATUS: Record<PurchaseStatus, { label: string; color: string }> = {
  paid: { label: 'مدفوعة', color: 'green' },
  partial: { label: 'جزئية', color: 'orange' },
  unpaid: { label: 'غير مدفوعة', color: 'red' },
};

/** `{ value, label }` options for Mantine Select / SegmentedControl. */
export const toOptions = <K extends string>(labels: Record<K, string>) =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));

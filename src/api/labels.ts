import { formatQty } from '../lib/money';
import type { AdjReason, PayMode, PayType, PurchaseStatus, StockStatus, Unit } from './types';

export const UNIT_LABELS: Record<Unit, string> = {
  kg: 'كغ',
  g: 'غ',
  l: 'لتر',
  ml: 'مل',
  pcs: 'حبة',
  pack: 'عبوة',
  tray: 'صينية',
};

/** Count units hold whole quantities; weight and volume units take up to 3 decimals. */
export const isCountUnit = (unit: Unit) => unit === 'pcs' || unit === 'pack' || unit === 'tray';

/** "2.5 كغ" */
export const formatUnitQty = (qty: number, unit: Unit) => `${formatQty(qty)} ${UNIT_LABELS[unit]}`;

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  monthly: 'شهري',
  weekly: 'أسبوعي',
  daily: 'يومي',
  hourly: 'بالساعة',
  production: 'بالإنتاج',
};

/** Baker pay mode label; `per_unit` pays per unit of the product (`unit`). */
export const payModeLabel = (mode: PayMode, unit: Unit) =>
  ({ none: 'بدون', per_unit: `لكل ${UNIT_LABELS[unit]}`, per_kg: 'بالوزن (كغ)', per_batch: 'لكل دفعة' })[mode];

/** Unit of a production worker's pay basis, by product pay mode and unit. */
export const payBasisUnit = (mode: PayMode, unit: Unit) =>
  ({ none: '', per_unit: UNIT_LABELS[unit], per_kg: 'كغ', per_batch: 'دفعة' })[mode];

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

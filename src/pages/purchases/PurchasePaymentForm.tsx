import { useState } from 'react';
import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { addPurchasePayment } from '../../api';
import type { Purchase } from '../../api/types';
import { MoneyInput } from '../../components/MoneyInput';
import { PaymentFields, type PaymentValue } from '../../components/PaymentFields';
import { toLocalDateString, withCurrentTime } from '../../lib/dates';
import { fromMilli, toMilli } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';

export function PurchasePaymentForm({ purchase, onDone }: { purchase: Purchase; onDone: () => void }) {
  const { fmt } = useMoney();
  const form = useForm({
    initialValues: {
      amount: fromMilli(purchase.balanceMilli) as number | string,
      date: toLocalDateString(new Date()) as string | null,
      note: '',
    },
    validate: {
      amount: (v) => {
        const m = toMilli(Number(v) || 0);
        if (m <= 0) return 'أدخل المبلغ';
        if (m > purchase.balanceMilli) return 'المبلغ أكبر من المتبقي';
        return null;
      },
      date: (v) => (v ? null : 'اختر التاريخ'),
    },
  });
  const [payment, setPayment] = useState<PaymentValue>({ method: 'cash', paidFromDrawer: false });
  const pay = useMutate(addPurchasePayment, 'تم تسجيل الدفعة', onDone);

  const submit = form.onSubmit((v) =>
    pay.mutate({
      purchaseId: purchase.id,
      amountMilli: toMilli(Number(v.amount)),
      method: payment.method,
      paidAt: withCurrentTime(v.date!),
      paidFromDrawer: payment.paidFromDrawer,
      note: v.note.trim() || null,
    }),
  );

  return (
    <form onSubmit={submit}>
      <Stack>
        <Text size="sm" c="dimmed">
          {purchase.supplierName ?? 'بدون مورد'}
          {purchase.invoiceNo ? ` — فاتورة ${purchase.invoiceNo}` : ''} — المتبقي: {fmt(purchase.balanceMilli)}
        </Text>
        <MoneyInput label="المبلغ" data-autofocus {...form.getInputProps('amount')} />
        <DatePickerInput label="التاريخ" valueFormat="YYYY/MM/DD" {...form.getInputProps('date')} />
        <PaymentFields method={payment.method} paidFromDrawer={payment.paidFromDrawer} onChange={setPayment} />
        <TextInput label="ملاحظة" {...form.getInputProps('note')} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            إلغاء
          </Button>
          <Button type="submit" loading={pay.isPending}>
            حفظ
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

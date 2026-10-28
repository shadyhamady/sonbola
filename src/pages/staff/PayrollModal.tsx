import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { createPayrollPayment } from '../../api';
import type { Method, Staff } from '../../api/types';
import { MoneyInput } from '../../components/MoneyInput';
import { PaymentFields } from '../../components/PaymentFields';
import { toLocalDateString, withCurrentTime } from '../../lib/dates';
import { fromMilli, toMilli } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';

interface Props {
  staff: Staff;
  onClose: () => void;
}

export function PayrollModal({ staff, onClose }: Props) {
  const { fmt } = useMoney();
  const defaultBase =
    staff.payType === 'production' ? Math.max(staff.owedMilli ?? 0, 0) : staff.rateMilli;
  const form = useForm({
    initialValues: {
      date: toLocalDateString(new Date()) as string | null,
      period: '',
      base: fromMilli(defaultBase) as number | string,
      bonus: 0 as number | string,
      deductions: 0 as number | string,
      method: 'cash' as Method,
      paidFromDrawer: false,
      note: '',
    },
    validate: {
      date: (v) => (v ? null : 'اختر التاريخ'),
    },
  });
  const save = useMutate(createPayrollPayment, 'تم صرف الراتب', onClose);

  const v = form.values;
  const baseMilli = toMilli(Number(v.base) || 0);
  const bonusMilli = toMilli(Number(v.bonus) || 0);
  const deductionsMilli = toMilli(Number(v.deductions) || 0);
  const netMilli = baseMilli + bonusMilli - deductionsMilli;

  return (
    <Modal opened onClose={onClose} title={`صرف راتب — ${staff.name}`}>
      <form
        onSubmit={form.onSubmit((values) =>
          save.mutate({
            staffId: staff.id,
            paidAt: withCurrentTime(values.date!),
            period: values.period.trim() || null,
            baseMilli,
            bonusMilli,
            deductionsMilli,
            method: values.method,
            paidFromDrawer: values.paidFromDrawer,
            note: values.note.trim() || null,
          }),
        )}
      >
        <Stack>
          <Group grow>
            <DatePickerInput label="التاريخ" valueFormat="YYYY/MM/DD" {...form.getInputProps('date')} />
            <TextInput label="الفترة" placeholder="مثال: مارس 2025" {...form.getInputProps('period')} />
          </Group>
          <MoneyInput label="الأساسي" data-autofocus {...form.getInputProps('base')} />
          <Group grow>
            <MoneyInput label="مكافأة" {...form.getInputProps('bonus')} />
            <MoneyInput label="خصومات" {...form.getInputProps('deductions')} />
          </Group>
          <Group justify="space-between">
            <Text fw={600}>الصافي</Text>
            <Text fw={700} size="lg" c={netMilli <= 0 ? 'red.8' : undefined}>
              {fmt(netMilli)}
            </Text>
          </Group>
          <PaymentFields
            method={v.method}
            paidFromDrawer={v.paidFromDrawer}
            onChange={(p) => form.setValues({ method: p.method, paidFromDrawer: p.paidFromDrawer })}
          />
          <TextInput label="ملاحظة" {...form.getInputProps('note')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" loading={save.isPending} disabled={netMilli <= 0}>
              صرف
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

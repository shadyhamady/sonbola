import { useState } from 'react';
import { ActionIcon, Button, Group, NumberInput, Paper, Select, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { randomId } from '@mantine/hooks';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createPurchase, listIngredients, listSuppliers } from '../../api';
import { UNIT_LABELS } from '../../api/labels';
import { MoneyInput } from '../../components/MoneyInput';
import { PaymentFields, type PaymentValue } from '../../components/PaymentFields';
import { toLocalDateString, withCurrentTime } from '../../lib/dates';
import { fromMilli, toMilli } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';

interface Line {
  key: string;
  ingredientId: string | null;
  qty: number | string;
  unitCost: number | string;
}

const newLine = (): Line => ({ key: randomId(), ingredientId: null, qty: '', unitCost: '' });

/** Display preview only; the backend computes the stored line totals. */
const lineTotalMilli = (l: Line) => Math.round((Number(l.qty) || 0) * toMilli(Number(l.unitCost) || 0));

export function NewPurchaseForm({ onDone }: { onDone: () => void }) {
  const { fmt } = useMoney();
  const { data: suppliers = [] } = useQuery({
    queryKey: ['list_suppliers', false],
    queryFn: () => listSuppliers(false),
  });
  const { data: ingredients = [] } = useQuery({
    queryKey: ['list_ingredients', false],
    queryFn: () => listIngredients(false),
  });

  const form = useForm({
    initialValues: {
      date: toLocalDateString(new Date()) as string | null,
      supplierId: null as string | null,
      invoiceNo: '',
      note: '',
      lines: [newLine()],
    },
    validate: {
      date: (v) => (v ? null : 'اختر التاريخ'),
      lines: {
        ingredientId: (v) => (v ? null : 'اختر المكوّن'),
        qty: (v) => (Number(v) > 0 ? null : 'كمية غير صالحة'),
        unitCost: (v) => (v !== '' && Number(v) >= 0 ? null : 'أدخل السعر'),
      },
    },
  });
  // "Paid now" follows the total until the user edits it.
  const [paidNow, setPaidNow] = useState<number | string | null>(null);
  const [payment, setPayment] = useState<PaymentValue>({ method: 'cash', paidFromDrawer: false });
  const create = useMutate(createPurchase, 'تم تسجيل الشراء', onDone);

  const totalMilli = form.values.lines.reduce((s, l) => s + lineTotalMilli(l), 0);
  const paidNowMilli = paidNow === null ? totalMilli : toMilli(Number(paidNow) || 0);
  const ingredientById = new Map(ingredients.map((i) => [String(i.id), i]));
  const ingredientOptions = ingredients.map((i) => ({ value: String(i.id), label: i.name }));

  const submit = form.onSubmit((v) =>
    create.mutate({
      supplierId: v.supplierId ? Number(v.supplierId) : null,
      invoiceNo: v.invoiceNo.trim() || null,
      purchasedAt: withCurrentTime(v.date!),
      note: v.note.trim() || null,
      items: v.lines.map((l) => ({
        ingredientId: Number(l.ingredientId),
        qty: Number(l.qty),
        unitCostMilli: toMilli(Number(l.unitCost)),
      })),
      paidNowMilli,
      method: payment.method,
      paidFromDrawer: paidNowMilli > 0 && payment.paidFromDrawer,
    }),
  );

  return (
    <form onSubmit={submit}>
      <Stack>
        <Group grow align="flex-start">
          <DatePickerInput label="التاريخ" valueFormat="YYYY/MM/DD" {...form.getInputProps('date')} />
          <Select
            label="المورد"
            placeholder="بدون مورد"
            clearable
            searchable
            nothingFoundMessage="لا توجد نتائج"
            data={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
            {...form.getInputProps('supplierId')}
          />
          <TextInput label="رقم الفاتورة" {...form.getInputProps('invoiceNo')} />
        </Group>

        <Paper withBorder p="sm">
          <Stack gap="xs">
            {form.values.lines.map((line, index) => {
              const ing = line.ingredientId ? ingredientById.get(line.ingredientId) : undefined;
              return (
                <Group key={line.key} align="flex-start" wrap="nowrap">
                  <Select
                    label={index === 0 ? 'المكوّن' : undefined}
                    placeholder="اختر المكوّن"
                    searchable
                    nothingFoundMessage="لا توجد نتائج"
                    data={ingredientOptions}
                    style={{ flex: 2 }}
                    {...form.getInputProps(`lines.${index}.ingredientId`)}
                  />
                  <NumberInput
                    label={index === 0 ? 'الكمية' : undefined}
                    min={0}
                    decimalScale={3}
                    hideControls
                    rightSection={
                      <Text size="xs" c="dimmed">
                        {ing ? UNIT_LABELS[ing.unit] : ''}
                      </Text>
                    }
                    rightSectionWidth={44}
                    style={{ flex: 1 }}
                    {...form.getInputProps(`lines.${index}.qty`)}
                  />
                  <MoneyInput
                    label={index === 0 ? 'سعر الوحدة' : undefined}
                    style={{ flex: 1 }}
                    {...form.getInputProps(`lines.${index}.unitCost`)}
                  />
                  <Stack gap={4} style={{ flex: 1 }}>
                    {index === 0 && (
                      <Text size="sm" fw={500}>
                        إجمالي السطر
                      </Text>
                    )}
                    <Text fw={600} lh="36px">
                      {fmt(lineTotalMilli(line))}
                    </Text>
                  </Stack>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    mt={index === 0 ? 28 : 4}
                    disabled={form.values.lines.length === 1}
                    onClick={() => form.removeListItem('lines', index)}
                    aria-label="حذف السطر"
                  >
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              );
            })}
            <Group justify="space-between">
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => form.insertListItem('lines', newLine())}
              >
                إضافة سطر
              </Button>
              <Text fw={700} size="lg">
                الإجمالي: {fmt(totalMilli)}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <MoneyInput
          label="المدفوع الآن"
          value={paidNow === null ? fromMilli(totalMilli) : paidNow}
          onChange={setPaidNow}
          error={paidNowMilli > totalMilli ? 'المبلغ أكبر من الإجمالي' : undefined}
        />
        <PaymentFields
          method={payment.method}
          paidFromDrawer={payment.paidFromDrawer}
          onChange={setPayment}
          disabled={paidNowMilli <= 0}
        />
        <TextInput label="ملاحظة" {...form.getInputProps('note')} />

        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            إلغاء
          </Button>
          <Button type="submit" loading={create.isPending} disabled={paidNowMilli > totalMilli}>
            حفظ
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

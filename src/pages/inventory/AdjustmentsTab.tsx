import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createStockAdjustment, deleteStockAdjustment, listIngredients, listProducts, listStockAdjustments } from '../../api';
import { ADJ_REASON_LABELS, UNIT_LABELS, toOptions } from '../../api/labels';
import type { AdjReason, ItemType } from '../../api/types';
import { RangePicker, useRange } from '../../components/RangePicker';
import { formatDateTime, toLocalDateString, withCurrentTime } from '../../lib/dates';
import { formatQty } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';

const ITEM_TYPE_LABELS: Record<ItemType, string> = { ingredient: 'مكوّن', product: 'منتج' };
const PRODUCT_UNIT = 'قطعة';

export function AdjustmentsTab() {
  const { fmt } = useMoney();
  const [range, setRange] = useRange();
  const [opened, setOpened] = useState(false);
  const { data: rows = [] } = useQuery({
    queryKey: ['list_stock_adjustments', range],
    queryFn: () => listStockAdjustments(range),
  });
  const del = useMutate(deleteStockAdjustment, 'تم الحذف');

  const confirmDelete = (id: number, name: string) =>
    modals.openConfirmModal({
      title: 'حذف التعديل',
      children: <Text size="sm">سيتم عكس أثر هذا التعديل على مخزون «{name}». هل أنت متأكد؟</Text>,
      labels: { confirm: 'حذف', cancel: 'إلغاء' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate(id),
    });

  const totalValue = rows.reduce((s, r) => s + r.valueMilli, 0);

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <RangePicker value={range} onChange={setRange} />
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          تعديل جديد
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={900}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>التاريخ</Table.Th>
              <Table.Th>النوع</Table.Th>
              <Table.Th>الصنف</Table.Th>
              <Table.Th>الكمية</Table.Th>
              <Table.Th>القيمة</Table.Th>
              <Table.Th>السبب</Table.Th>
              <Table.Th>ملاحظة</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" ta="center">
                    لا توجد تعديلات في هذه الفترة
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{formatDateTime(r.adjustedAt)}</Table.Td>
                <Table.Td>{ITEM_TYPE_LABELS[r.itemType]}</Table.Td>
                <Table.Td fw={600}>{r.itemName}</Table.Td>
                <Table.Td c={r.qtyDelta < 0 ? 'red.8' : 'green.8'}>
                  <span dir="ltr">
                    {r.qtyDelta > 0 ? '+' : ''}
                    {formatQty(r.qtyDelta)}
                  </span>{' '}
                  {r.itemType === 'product' ? PRODUCT_UNIT : UNIT_LABELS[r.unit]}
                </Table.Td>
                <Table.Td c={r.valueMilli < 0 ? 'red.8' : undefined}>{fmt(r.valueMilli)}</Table.Td>
                <Table.Td>{ADJ_REASON_LABELS[r.reason]}</Table.Td>
                <Table.Td>{r.note}</Table.Td>
                <Table.Td>
                  <Tooltip label="حذف">
                    <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete(r.id, r.itemName)}>
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={4}>الإجمالي</Table.Th>
              <Table.Th c={totalValue < 0 ? 'red.8' : undefined}>{fmt(totalValue)}</Table.Th>
              <Table.Th colSpan={3} />
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={opened} onClose={() => setOpened(false)} title="تعديل مخزون جديد">
        {opened && <AdjustmentForm onDone={() => setOpened(false)} />}
      </Modal>
    </Stack>
  );
}

function AdjustmentForm({ onDone }: { onDone: () => void }) {
  const { data: ingredients = [] } = useQuery({
    queryKey: ['list_ingredients', false],
    queryFn: () => listIngredients(false),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['list_products', false],
    queryFn: () => listProducts(false),
  });

  const form = useForm({
    initialValues: {
      date: toLocalDateString(new Date()) as string | null,
      itemType: 'ingredient' as ItemType,
      itemId: null as string | null,
      direction: 'dec' as 'dec' | 'inc',
      qty: '' as number | string,
      reason: 'waste' as AdjReason,
      note: '',
    },
    validate: {
      date: (v) => (v ? null : 'اختر التاريخ'),
      itemId: (v) => (v ? null : 'اختر الصنف'),
      qty: (v, values) => {
        const n = Number(v);
        if (v === '' || !(n > 0)) return 'أدخل كمية أكبر من صفر';
        if (values.itemType === 'product' && !Number.isInteger(n)) return 'الكمية يجب أن تكون عدداً صحيحاً';
        return null;
      },
    },
  });
  const create = useMutate(createStockAdjustment, 'تم الحفظ', onDone);

  const isProduct = form.values.itemType === 'product';
  const itemOptions = isProduct
    ? products.map((p) => ({ value: String(p.id), label: `${p.name} (المخزون: ${formatQty(p.stockQty)})` }))
    : ingredients.map((i) => ({
        value: String(i.id),
        label: `${i.name} (المخزون: ${formatQty(i.stockQty)} ${UNIT_LABELS[i.unit]})`,
      }));
  const selectedIngredient = !isProduct ? ingredients.find((i) => String(i.id) === form.values.itemId) : undefined;
  const unitLabel = isProduct ? PRODUCT_UNIT : selectedIngredient ? UNIT_LABELS[selectedIngredient.unit] : '';

  const submit = form.onSubmit((v) => {
    const qty = Number(v.qty);
    create.mutate({
      itemType: v.itemType,
      itemId: Number(v.itemId),
      qtyDelta: v.direction === 'dec' ? -qty : qty,
      reason: v.reason,
      adjustedAt: withCurrentTime(v.date!),
      note: v.note.trim() || null,
    });
  });

  return (
    <form onSubmit={submit}>
      <Stack>
        <DatePickerInput label="التاريخ" valueFormat="YYYY/MM/DD" {...form.getInputProps('date')} />
        <div>
          <Text size="sm" fw={500} mb={4}>
            النوع
          </Text>
          <SegmentedControl
            fullWidth
            data={toOptions(ITEM_TYPE_LABELS)}
            value={form.values.itemType}
            onChange={(v) => {
              form.setFieldValue('itemType', v as ItemType);
              form.setFieldValue('itemId', null);
            }}
          />
        </div>
        <Select
          label="الصنف"
          placeholder="اختر"
          searchable
          nothingFoundMessage="لا توجد نتائج"
          data={itemOptions}
          {...form.getInputProps('itemId')}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            الاتجاه
          </Text>
          <SegmentedControl
            fullWidth
            data={[
              { value: 'dec', label: 'نقص' },
              { value: 'inc', label: 'زيادة' },
            ]}
            color={form.values.direction === 'dec' ? 'red' : 'green'}
            {...form.getInputProps('direction')}
          />
        </div>
        <NumberInput
          label="الكمية"
          min={0}
          decimalScale={isProduct ? 0 : 3}
          allowDecimal={!isProduct}
          hideControls
          rightSection={<Text size="xs" c="dimmed">{unitLabel}</Text>}
          rightSectionWidth={50}
          {...form.getInputProps('qty')}
        />
        <Select
          label="السبب"
          data={toOptions(ADJ_REASON_LABELS)}
          allowDeselect={false}
          {...form.getInputProps('reason')}
        />
        <TextInput label="ملاحظة" {...form.getInputProps('note')} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            إلغاء
          </Button>
          <Button type="submit" loading={create.isPending}>
            حفظ
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

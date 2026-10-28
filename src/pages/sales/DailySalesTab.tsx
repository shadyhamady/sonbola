import { useState } from 'react';
import { ActionIcon, Alert, Button, Group, Modal, SimpleGrid, Stack, Table, Text, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { IconAlertTriangle, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createDailySale, deleteDailySale, listDailySales, updateDailySale } from '../../api';
import type { DailySale, DailySaleInput } from '../../api/types';
import { MoneyInput } from '../../components/MoneyInput';
import { RangePicker, useRange } from '../../components/RangePicker';
import { formatDate, toLocalDateString } from '../../lib/dates';
import { fromMilli, toMilli } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';

const AMOUNT_FIELDS = [
  { key: 'cash', label: 'نقداً' },
  { key: 'card', label: 'بطاقة' },
  { key: 'online', label: 'أونلاين / تطبيقات التوصيل' },
  { key: 'other', label: 'أخرى' },
] as const;

export function DailySalesTab() {
  const { fmt } = useMoney();
  const [range, setRange] = useRange();
  const { data: rows = [] } = useQuery({ queryKey: ['list_daily_sales', range], queryFn: () => listDailySales(range) });
  // undefined = closed, null = new entry, DailySale = editing.
  const [editing, setEditing] = useState<DailySale | null | undefined>(undefined);
  const del = useMutate(deleteDailySale, 'تم الحذف');

  const sum = (pick: (r: DailySale) => number) => rows.reduce((s, r) => s + pick(r), 0);

  return (
    <Stack>
      <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
        لا تُدخل هنا مبيعات نقطة البيع، فهي محسوبة تلقائياً
      </Alert>
      <Group justify="space-between" align="flex-end">
        <RangePicker value={range} onChange={setRange} />
        <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing(null)}>
          إدخال مبيعات يوم
        </Button>
      </Group>
      <Table.ScrollContainer minWidth={700}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>التاريخ</Table.Th>
              {AMOUNT_FIELDS.map((f) => (
                <Table.Th key={f.key}>{f.label}</Table.Th>
              ))}
              <Table.Th>الإجمالي</Table.Th>
              <Table.Th>ملاحظة</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" ta="center">
                    لا توجد مبيعات يدوية في هذه الفترة
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{formatDate(r.saleDate)}</Table.Td>
                <Table.Td>{fmt(r.cashMilli)}</Table.Td>
                <Table.Td>{fmt(r.cardMilli)}</Table.Td>
                <Table.Td>{fmt(r.onlineMilli)}</Table.Td>
                <Table.Td>{fmt(r.otherMilli)}</Table.Td>
                <Table.Td fw={700}>{fmt(r.totalMilli)}</Table.Td>
                <Table.Td>{r.note}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon variant="subtle" onClick={() => setEditing(r)} aria-label="تعديل">
                      <IconPencil size={18} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label="حذف"
                      onClick={() =>
                        modals.openConfirmModal({
                          title: 'حذف الإدخال',
                          children: <Text size="sm">{`هل تريد حذف مبيعات يوم ${formatDate(r.saleDate)}؟`}</Text>,
                          labels: { confirm: 'حذف', cancel: 'إلغاء' },
                          confirmProps: { color: 'red' },
                          onConfirm: () => del.mutate(r.id),
                        })
                      }
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          {rows.length > 0 && (
            <Table.Tfoot>
              <Table.Tr fw={700}>
                <Table.Td>الإجمالي</Table.Td>
                <Table.Td>{fmt(sum((r) => r.cashMilli))}</Table.Td>
                <Table.Td>{fmt(sum((r) => r.cardMilli))}</Table.Td>
                <Table.Td>{fmt(sum((r) => r.onlineMilli))}</Table.Td>
                <Table.Td>{fmt(sum((r) => r.otherMilli))}</Table.Td>
                <Table.Td>{fmt(sum((r) => r.totalMilli))}</Table.Td>
                <Table.Td colSpan={2} />
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Table.ScrollContainer>
      <Modal
        opened={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? 'تعديل مبيعات يوم' : 'إدخال مبيعات يوم'}
        centered
      >
        {editing !== undefined && <DailySaleForm row={editing} onDone={() => setEditing(undefined)} />}
      </Modal>
    </Stack>
  );
}

function DailySaleForm({ row, onDone }: { row: DailySale | null; onDone: () => void }) {
  const { fmt } = useMoney();
  const form = useForm({
    initialValues: {
      saleDate: row?.saleDate ?? toLocalDateString(new Date()),
      cash: row ? fromMilli(row.cashMilli) : ('' as number | string),
      card: row ? fromMilli(row.cardMilli) : ('' as number | string),
      online: row ? fromMilli(row.onlineMilli) : ('' as number | string),
      other: row ? fromMilli(row.otherMilli) : ('' as number | string),
      note: row?.note ?? '',
    },
    validate: { saleDate: (v) => (v ? null : 'اختر التاريخ') },
  });
  const save = useMutate<DailySaleInput, unknown>(row ? updateDailySale : createDailySale, 'تم الحفظ', onDone);

  const milli = (v: number | string) => toMilli(Number(v) || 0);
  const v = form.values;
  const totalMilli = milli(v.cash) + milli(v.card) + milli(v.online) + milli(v.other);

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        save.mutate({
          id: row?.id ?? null,
          saleDate: values.saleDate,
          cashMilli: milli(values.cash),
          cardMilli: milli(values.card),
          onlineMilli: milli(values.online),
          otherMilli: milli(values.other),
          note: values.note.trim() || null,
        }),
      )}
    >
      <Stack>
        <DatePickerInput label="التاريخ" valueFormat="YYYY/MM/DD" {...form.getInputProps('saleDate')} />
        <SimpleGrid cols={2}>
          {AMOUNT_FIELDS.map((f) => (
            <MoneyInput key={f.key} label={f.label} {...form.getInputProps(f.key)} />
          ))}
        </SimpleGrid>
        <Group justify="space-between">
          <Text fw={600}>الإجمالي</Text>
          <Text fw={700} size="xl">
            {fmt(totalMilli)}
          </Text>
        </Group>
        <Textarea label="ملاحظة" autosize minRows={2} {...form.getInputProps('note')} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            إلغاء
          </Button>
          <Button type="submit" loading={save.isPending}>
            حفظ
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

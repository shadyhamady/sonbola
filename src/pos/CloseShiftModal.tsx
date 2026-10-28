import { useState } from 'react';
import { Button, Center, Group, Loader, Modal, Stack, Table, Text, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { closeShift, shiftSummary } from '../api';
import type { Shift } from '../api/types';
import { MoneyInput } from '../components/MoneyInput';
import { useOpenShift } from '../components/PaymentFields';
import { formatDateTime } from '../lib/dates';
import { toMilli } from '../lib/money';
import { useMutate } from '../lib/useMutate';
import { useMoney } from '../lib/useSettings';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function CloseShiftModal({ opened, onClose }: Props) {
  const { data: openShift } = useOpenShift();
  return (
    <Modal opened={opened} onClose={onClose} title="إغلاق الوردية" centered size="md">
      {openShift ? <CloseShiftForm shift={openShift} onClose={onClose} /> : <Text c="dimmed">لا توجد وردية مفتوحة</Text>}
    </Modal>
  );
}

/** Colored "counted − expected" label: green when balanced, red shortage, orange surplus. */
export function CashDifference({ diffMilli, fmt }: { diffMilli: number; fmt: (m: number) => string }) {
  if (diffMilli === 0)
    return (
      <Text c="green" fw={700}>
        {fmt(0)} (متطابق)
      </Text>
    );
  if (diffMilli < 0)
    return (
      <Text c="red" fw={700}>
        عجز {fmt(-diffMilli)}
      </Text>
    );
  return (
    <Text c="orange" fw={700}>
      زيادة {fmt(diffMilli)}
    </Text>
  );
}

function CloseShiftForm({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { fmt } = useMoney();
  const { data: summary, isLoading } = useQuery({
    queryKey: ['shift_summary', shift.id],
    queryFn: () => shiftSummary(shift.id),
  });
  const [counted, setCounted] = useState<string | number>('');
  const [note, setNote] = useState('');
  const close = useMutate(closeShift, 'تم إغلاق الوردية', onClose);

  if (isLoading || !summary)
    return (
      <Center h={120}>
        <Loader />
      </Center>
    );

  const countedMilli = counted === '' ? null : toMilli(Number(counted) || 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (countedMilli === null) return;
        close.mutate({ countedCashMilli: countedMilli, note: note.trim() || null });
      }}
    >
      <Stack>
        <Table withRowBorders={false} verticalSpacing={4}>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>بداية الوردية</Table.Td>
              <Table.Td>{formatDateTime(shift.openedAt)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>النقد الافتتاحي</Table.Td>
              <Table.Td>{fmt(shift.openingCashMilli)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>المبيعات ({summary.saleCount} فاتورة)</Table.Td>
              <Table.Td>{fmt(summary.salesTotalMilli)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>مدفوعات من الدرج</Table.Td>
              <Table.Td>{fmt(summary.drawerPaymentsMilli)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={700}>النقد المتوقع</Table.Td>
              <Table.Td fw={700}>{fmt(summary.expectedCashMilli)}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
        <MoneyInput label="النقد المعدود" size="lg" data-autofocus required value={counted} onChange={setCounted} />
        {countedMilli !== null && (
          <Group justify="space-between">
            <Text>الفرق</Text>
            <CashDifference diffMilli={countedMilli - summary.expectedCashMilli} fmt={fmt} />
          </Group>
        )}
        <Textarea label="ملاحظة" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" color="red" disabled={countedMilli === null} loading={close.isPending}>
            تأكيد الإغلاق
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

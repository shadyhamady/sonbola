import { useState } from 'react';
import { Alert, Button, Center, Group, Loader, Modal, Stack, Table, Text, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { closeShift, shiftSummary } from '../api';
import type { Shift, ShiftSummary } from '../api/types';
import { invoiceCount } from '../lib/arabic';
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
  // Kept here: once closed, the open-shift query empties but the summary must stay on screen.
  const [closed, setClosed] = useState<ShiftSummary | null>(null);
  const finish = () => {
    setClosed(null);
    onClose();
  };
  return (
    <Modal opened={opened} onClose={finish} title={closed ? 'ملخص الوردية' : 'إغلاق الوردية'} centered size="md">
      {closed ? (
        <ShiftReport summary={closed} onDone={finish} />
      ) : openShift ? (
        <CloseShiftForm key={openShift.id} shift={openShift} onCancel={finish} onClosed={setClosed} />
      ) : (
        <Text c="dimmed">لا توجد وردية مفتوحة</Text>
      )}
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

/**
 * Blind count: the cashier enters the counted cash before seeing what was expected, so the
 * count can't be anchored to (or copied from) the target. Any difference needs a reason.
 */
function CloseShiftForm({
  shift,
  onCancel,
  onClosed,
}: {
  shift: Shift;
  onCancel: () => void;
  onClosed: (summary: ShiftSummary) => void;
}) {
  const { fmt } = useMoney();
  const [step, setStep] = useState<'count' | 'review'>('count');
  const [counted, setCounted] = useState<string | number>('');
  const [note, setNote] = useState('');
  const { data: summary } = useQuery({
    queryKey: ['shift_summary', shift.id],
    queryFn: () => shiftSummary(shift.id),
    enabled: step === 'review',
  });
  const close = useMutate(closeShift, 'تم إغلاق الوردية', onClosed);
  const countedMilli = counted === '' ? null : toMilli(Number(counted) || 0);

  if (step === 'count')
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (countedMilli !== null) setStep('review');
        }}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            الوردية مفتوحة منذ {formatDateTime(shift.openedAt)}. عُدّ النقد الموجود في الدرج وأدخل المبلغ.
          </Text>
          <MoneyInput label="النقد المعدود في الدرج" size="lg" data-autofocus required value={counted} onChange={setCounted} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onCancel}>
              إلغاء
            </Button>
            <Button type="submit" disabled={countedMilli === null}>
              التالي
            </Button>
          </Group>
        </Stack>
      </form>
    );

  if (!summary || countedMilli === null)
    return (
      <Center h={120}>
        <Loader />
      </Center>
    );

  const diffMilli = countedMilli - summary.expectedCashMilli;
  const needsNote = diffMilli !== 0 && !note.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!needsNote) close.mutate({ countedCashMilli: countedMilli, note: note.trim() || null });
      }}
    >
      <Stack>
        <SummaryTable summary={summary} countedMilli={countedMilli} />
        <Group justify="space-between">
          <Text fw={600}>الفرق</Text>
          <CashDifference diffMilli={diffMilli} fmt={fmt} />
        </Group>
        {diffMilli < 0 && (
          <Alert color="red" variant="light">
            يوجد عجز في الدرج. أعد العدّ إن أمكن، أو اذكر السبب قبل الإغلاق.
          </Alert>
        )}
        <Textarea
          label={diffMilli === 0 ? 'ملاحظة' : 'سبب الفرق'}
          required={diffMilli !== 0}
          autosize
          minRows={2}
          data-autofocus={diffMilli !== 0 || undefined}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="space-between">
          <Button variant="subtle" onClick={() => setStep('count')}>
            إعادة العدّ
          </Button>
          <Group>
            <Button variant="default" onClick={onCancel}>
              إلغاء
            </Button>
            <Button type="submit" color="red" disabled={needsNote} loading={close.isPending}>
              تأكيد الإغلاق
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}

function SummaryTable({ summary, countedMilli }: { summary: ShiftSummary; countedMilli: number }) {
  const { fmt } = useMoney();
  const rows: [string, string, boolean?][] = [
    ['بداية الوردية', formatDateTime(summary.shift.openedAt)],
    ['النقد الافتتاحي', fmt(summary.shift.openingCashMilli)],
    [`المبيعات (${invoiceCount(summary.saleCount)})`, fmt(summary.salesTotalMilli)],
    ['مدفوعات من الدرج', fmt(summary.drawerPaymentsMilli ? -summary.drawerPaymentsMilli : 0)],
    ['النقد المتوقع', fmt(summary.expectedCashMilli), true],
    ['النقد المعدود', fmt(countedMilli), true],
  ];
  return (
    <Table withRowBorders={false} verticalSpacing={4}>
      <Table.Tbody>
        {rows.map(([label, value, bold]) => (
          <Table.Tr key={label}>
            <Table.Td fw={bold ? 700 : undefined}>{label}</Table.Td>
            <Table.Td fw={bold ? 700 : undefined}>{value}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

/** Shown after closing: the hand-over record of the shift. */
function ShiftReport({ summary, onDone }: { summary: ShiftSummary; onDone: () => void }) {
  const { fmt } = useMoney();
  const counted = summary.shift.countedCashMilli ?? 0;
  const expected = summary.shift.expectedCashMilli ?? summary.expectedCashMilli;
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        أُغلقت الوردية {summary.shift.closedAt ? formatDateTime(summary.shift.closedAt) : ''}
      </Text>
      <SummaryTable summary={summary} countedMilli={counted} />
      <Group justify="space-between">
        <Text fw={600}>الفرق</Text>
        <CashDifference diffMilli={counted - expected} fmt={fmt} />
      </Group>
      {summary.shift.note && (
        <Text size="sm">
          <Text span fw={600}>
            ملاحظة:{' '}
          </Text>
          {summary.shift.note}
        </Text>
      )}
      <Button size="lg" data-autofocus onClick={onDone}>
        تم
      </Button>
    </Stack>
  );
}

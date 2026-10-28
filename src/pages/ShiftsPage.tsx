import { invoiceCount } from '../lib/arabic';
import { Badge, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { listShifts } from '../api';
import { RangePicker, useRange } from '../components/RangePicker';
import { formatDateTime } from '../lib/dates';
import { useMoney } from '../lib/useSettings';
import { CashDifference } from '../pos/CloseShiftModal';

export function ShiftsPage() {
  const { fmt } = useMoney();
  const [range, setRange] = useRange();
  const { data: shifts = [] } = useQuery({ queryKey: ['list_shifts', range], queryFn: () => listShifts(range) });

  return (
    <Stack>
      <Title order={2}>الورديات</Title>
      <RangePicker value={range} onChange={setRange} />
      <Table.ScrollContainer minWidth={700}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>الفتح</Table.Th>
              <Table.Th>الإغلاق</Table.Th>
              <Table.Th>النقد الافتتاحي</Table.Th>
              <Table.Th>المبيعات</Table.Th>
              <Table.Th>مدفوعات من الدرج</Table.Th>
              <Table.Th>المتوقع</Table.Th>
              <Table.Th>المعدود</Table.Th>
              <Table.Th>الفرق</Table.Th>
              <Table.Th>ملاحظة</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {shifts.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" ta="center">
                    لا توجد ورديات في هذه الفترة
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {shifts.map(({ shift, saleCount, salesTotalMilli, drawerPaymentsMilli, expectedCashMilli }) => {
              const closed = shift.closedAt !== null;
              const expected = shift.expectedCashMilli ?? expectedCashMilli;
              return (
                <Table.Tr key={shift.id}>
                  <Table.Td>{formatDateTime(shift.openedAt)}</Table.Td>
                  <Table.Td>
                    {closed ? (
                      formatDateTime(shift.closedAt!)
                    ) : (
                      <Badge color="green" variant="light">
                        مفتوحة
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{fmt(shift.openingCashMilli)}</Table.Td>
                  <Table.Td>
                    {fmt(salesTotalMilli)}{' '}
                    <Text span size="xs" c="dimmed">
                      ({invoiceCount(saleCount)})
                    </Text>
                  </Table.Td>
                  <Table.Td>{fmt(drawerPaymentsMilli)}</Table.Td>
                  <Table.Td>{fmt(expected)}</Table.Td>
                  <Table.Td>{shift.countedCashMilli !== null ? fmt(shift.countedCashMilli) : '—'}</Table.Td>
                  <Table.Td>
                    {closed && shift.countedCashMilli !== null ? (
                      <CashDifference diffMilli={shift.countedCashMilli - expected} fmt={fmt} />
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                  <Table.Td>{shift.note}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

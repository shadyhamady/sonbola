import { Paper, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { listProductions } from '../../api';
import { formatUnitQty } from '../../api/labels';
import type { Unit } from '../../api/types';
import { RangePicker, useRange } from '../../components/RangePicker';
import { formatDateTime } from '../../lib/dates';
import { formatQty } from '../../lib/money';
import { useMoney } from '../../lib/useSettings';

export function ProductionHistory() {
  const { fmt } = useMoney();
  const [range, setRange] = useRange();
  const productions = useQuery({ queryKey: ['listProductions', range], queryFn: () => listProductions(range) });
  const rows = productions.data ?? [];

  const totals = rows.reduce(
    (t, r) => ({
      ingredients: t.ingredients + r.ingredientCostMilli,
      labor: t.labor + r.laborCostMilli,
      overhead: t.overhead + r.overheadMilli,
    }),
    { ingredients: 0, labor: 0, overhead: 0 },
  );
  const unitTotals = new Map<Unit, number>();
  for (const r of rows) unitTotals.set(r.productUnit, (unitTotals.get(r.productUnit) ?? 0) + r.units);
  const unitsTotalLabel = [...unitTotals].map(([unit, qty]) => formatUnitQty(qty, unit)).join(' • ');

  return (
    <Paper withBorder p="md">
      <Stack>
        <Title order={3} size="h4">
          سجل الإنتاج
        </Title>
        <RangePicker value={range} onChange={setRange} />
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>التاريخ</Table.Th>
                <Table.Th>المنتج</Table.Th>
                <Table.Th>الكمية</Table.Th>
                <Table.Th>تكلفة المكونات</Table.Th>
                <Table.Th>أجر الخبازين</Table.Th>
                <Table.Th>التشغيل</Table.Th>
                <Table.Th>الخبازون</Table.Th>
                <Table.Th>ملاحظة</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{formatDateTime(r.producedAt)}</Table.Td>
                  <Table.Td>{r.productName}</Table.Td>
                  <Table.Td>
                    {formatUnitQty(r.units, r.productUnit)}
                    {r.inputUnit && r.inputQty != null && (
                      <Text size="xs" c="dimmed">
                        {formatQty(r.inputQty)} {r.inputUnit === 'kg' ? 'كغ عجين' : 'دفعة'}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{fmt(r.ingredientCostMilli)}</Table.Td>
                  <Table.Td>{fmt(r.laborCostMilli)}</Table.Td>
                  <Table.Td>{fmt(r.overheadMilli)}</Table.Td>
                  <Table.Td>{r.workerNames.join('، ') || '—'}</Table.Td>
                  <Table.Td>{r.note}</Table.Td>
                </Table.Tr>
              ))}
              {rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed" ta="center" py="md">
                      {productions.isLoading ? 'جارٍ التحميل…' : 'لا يوجد إنتاج في هذه الفترة'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
            {rows.length > 0 && (
              <Table.Tfoot>
                <Table.Tr fw={700}>
                  <Table.Td colSpan={2}>الإجمالي</Table.Td>
                  <Table.Td>{unitsTotalLabel}</Table.Td>
                  <Table.Td>{fmt(totals.ingredients)}</Table.Td>
                  <Table.Td>{fmt(totals.labor)}</Table.Td>
                  <Table.Td>{fmt(totals.overhead)}</Table.Td>
                  <Table.Td colSpan={2} />
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </Table.ScrollContainer>
        <Text size="sm" c="dimmed">
          لتصحيح الإنتاج استخدم تعديلات المخزون
        </Text>
      </Stack>
    </Paper>
  );
}

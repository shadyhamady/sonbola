import { useMemo } from 'react';
import { Badge, Grid, Group, Paper, Progress, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { dashboardSnapshot, periodReport, shiftSummary } from '../api';
import { STOCK_STATUS, UNIT_LABELS } from '../api/labels';
import type { PeriodReport } from '../api/types';
import { useOpenShift } from '../components/PaymentFields';
import { formatTime, lastNDaysRange, monthRange, todayRange, yearToDateRange } from '../lib/dates';
import { formatPct, formatQty, toMilli } from '../lib/money';
import { useMoney } from '../lib/useSettings';
import { SalesByDayChart, StatCard } from './reports/shared';

type Fmt = (milli: number) => string;

interface PnlRow {
  label: string;
  render: (r: PeriodReport, fmt: Fmt) => string;
  color?: (r: PeriodReport) => string | undefined;
}

const PNL_ROWS: PnlRow[] = [
  { label: 'المبيعات', render: (r, f) => f(r.salesMilli) },
  { label: 'المصروفات التشغيلية', render: (r, f) => f(r.operatingExpensesMilli) },
  { label: 'مشتريات المكونات', render: (r, f) => f(r.ingredientPurchasesMilli) },
  { label: 'مشتريات الديزل', render: (r, f) => f(r.dieselPurchasesMilli) },
  { label: 'الرواتب', render: (r, f) => f(r.wagesMilli) },
  { label: 'إجمالي التكاليف', render: (r, f) => f(r.totalCostsMilli) },
  {
    label: 'صافي الربح',
    render: (r, f) => f(r.netProfitMilli),
    color: (r) => (r.netProfitMilli < 0 ? 'red' : 'green'),
  },
  { label: 'هامش الربح', render: (r) => formatPct(r.profitMargin) },
  { label: 'متوسط المبيعات اليومية', render: (r, f) => f(r.avgDailySalesMilli) },
  { label: 'تكلفة مكونات الإنتاج', render: (r, f) => f(r.productionIngredientCostMilli) },
  { label: 'الديزل المستهلك (لتر)', render: (r) => formatQty(r.dieselLitersUsed) },
  { label: 'تكلفة الديزل المستهلك', render: (r, f) => f(r.dieselCostUsedMilli) },
  { label: 'تكلفة الديزل لكل قطعة', render: (r, f) => f(r.dieselCostPerItemMilli) },
  { label: 'المخزون المشطوب (هدر)', render: (r, f) => f(r.stockWrittenOffMilli) },
  { label: 'أجور الإنتاج المستحقة', render: (r, f) => f(r.bakerPayEarnedMilli) },
];

export function DashboardPage() {
  const { fmt } = useMoney();
  // Ranges are fixed for the page's lifetime so query keys stay stable.
  const ranges = useMemo(
    () => ({
      today: todayRange(),
      week: lastNDaysRange(7),
      month: monthRange(),
      ytd: yearToDateRange(),
    }),
    [],
  );

  const today = useQuery({ queryKey: ['period_report', ranges.today], queryFn: () => periodReport(ranges.today) });
  const week = useQuery({ queryKey: ['period_report', ranges.week], queryFn: () => periodReport(ranges.week) });
  const month = useQuery({ queryKey: ['period_report', ranges.month], queryFn: () => periodReport(ranges.month) });
  const ytd = useQuery({ queryKey: ['period_report', ranges.ytd], queryFn: () => periodReport(ranges.ytd) });
  const snapshot = useQuery({ queryKey: ['dashboard_snapshot'], queryFn: dashboardSnapshot });

  const { data: openShift } = useOpenShift();
  const summary = useQuery({
    queryKey: ['shift_summary', openShift?.id],
    queryFn: () => shiftSummary(openShift!.id),
    enabled: !!openShift,
  });

  const snap = snapshot.data;
  const chartFmt = (major: number) => fmt(toMilli(major));

  return (
    <Stack gap="lg">
      <Title order={2}>لوحة التحكم</Title>

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
          <StatCard label="مبيعات اليوم" value={today.data ? fmt(today.data.salesMilli) : '—'}>
            {today.data && (
              <Text size="sm" c="dimmed">
                نقطة البيع: {fmt(today.data.posSalesMilli)} • يدوي: {fmt(today.data.manualSalesMilli)}
              </Text>
            )}
          </StatCard>
          <StatCard
            label="الوردية"
            value={openShift ? 'مفتوحة' : 'لا توجد وردية مفتوحة'}
            color={openShift ? 'green' : 'dimmed'}
          >
            {openShift && (
              <Text size="sm" c="dimmed">
                مفتوحة منذ {formatTime(openShift.openedAt)}
                {summary.data &&
                  ` • المبيعات: ${fmt(summary.data.salesTotalMilli)} (${summary.data.saleCount} فاتورة)`}
              </Text>
            )}
          </StatCard>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
        <Paper withBorder p="md" radius="md" h="100%">
          <Text fw={600} mb="sm">
            مبيعات آخر 7 أيام
          </Text>
          {week.data && (
            <SalesByDayChart range={ranges.week} days={week.data.salesByDay} valueFormatter={chartFmt} h={220} />
          )}
        </Paper>
        </Grid.Col>
      </Grid>

      <Paper withBorder p="md" radius="md">
        <Title order={4} mb="sm">
          الأرباح والخسائر (نقدي)
        </Title>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>البند</Table.Th>
              <Table.Th>هذا الشهر</Table.Th>
              <Table.Th>منذ بداية السنة</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {PNL_ROWS.map((row) => (
              <Table.Tr key={row.label}>
                <Table.Td fw={600}>{row.label}</Table.Td>
                {[month.data, ytd.data].map((r, i) => (
                  <Table.Td key={i} c={r && row.color ? row.color(r) : undefined} fw={row.color ? 700 : undefined}>
                    {r ? row.render(r, fmt) : '—'}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Stack gap="sm">
        <Title order={4}>الوضع الحالي</Title>
        {snap && (
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <StatCard label="قيمة المخزون" value={fmt(snap.stockValueMilli)} />
            <StatCard
              label="مكونات يجب إعادة طلبها"
              value={snap.reorderCount}
              color={snap.reorderCount > 0 ? 'orange' : undefined}
            />
            <StatCard label="مكونات نفدت" value={snap.outCount} color={snap.outCount > 0 ? 'red' : undefined} />
            <StatCard label="مستحق للموردين" value={fmt(snap.owedToSuppliersMilli)}>
              <Text size="sm" c="dimmed">
                فواتير غير مسددة: {snap.unpaidInvoices}
              </Text>
            </StatCard>
            <StatCard
              label="منتجات بدون وصفة"
              value={snap.productsWithoutRecipe}
              color={snap.productsWithoutRecipe > 0 ? 'red' : undefined}
            />
            <StatCard label="الديزل في الخزان" value={`${formatQty(snap.dieselInTankL)} لتر`}>
              <Group gap="xs" mt={4} wrap="nowrap">
                <Progress
                  value={Math.max(0, Math.min(100, snap.tankLevel * 100))}
                  color={snap.tankLevel < 0.2 ? 'red' : 'orange'}
                  style={{ flex: 1 }}
                />
                <Text size="sm">{formatPct(snap.tankLevel)}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                أيام متبقية: {snap.daysOfDieselLeft == null ? '—' : formatQty(Math.round(snap.daysOfDieselLeft * 10) / 10)}
              </Text>
            </StatCard>
            <StatCard label="مستحق للموظفين" value={fmt(snap.owedToStaffMilli)} />
          </SimpleGrid>
        )}
      </Stack>

      <Paper withBorder p="md" radius="md">
        <Title order={4} mb="sm">
          قائمة التسوق
        </Title>
        {snap && snap.shoppingList.length === 0 ? (
          <Text c="dimmed">لا يوجد نقص</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>المكوّن</Table.Th>
                <Table.Th>المخزون</Table.Th>
                <Table.Th>حد إعادة الطلب</Table.Th>
                <Table.Th>الوحدة</Table.Th>
                <Table.Th>الحالة</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {snap?.shoppingList.map((item) => (
                <Table.Tr key={item.name}>
                  <Table.Td>{item.name}</Table.Td>
                  <Table.Td c={item.stockQty < 0 ? 'red' : undefined}>{formatQty(item.stockQty)}</Table.Td>
                  <Table.Td>{formatQty(item.reorderQty)}</Table.Td>
                  <Table.Td>{UNIT_LABELS[item.unit]}</Table.Td>
                  <Table.Td>
                    <Badge color={STOCK_STATUS[item.status].color}>{STOCK_STATUS[item.status].label}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        <Title order={5} mt="lg" mb="sm">
          منتجات منخفضة المخزون
        </Title>
        {snap && snap.lowStockProducts.length === 0 ? (
          <Text c="dimmed">لا يوجد نقص</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>المنتج</Table.Th>
                <Table.Th>المخزون</Table.Th>
                <Table.Th>حد التنبيه</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {snap?.lowStockProducts.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.name}</Table.Td>
                  <Table.Td c={p.stockQty < 0 ? 'red' : undefined}>{formatQty(p.stockQty)}</Table.Td>
                  <Table.Td>{formatQty(p.lowStockQty)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

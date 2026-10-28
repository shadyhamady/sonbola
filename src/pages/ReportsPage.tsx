import { useState } from 'react';
import { Grid, Group, Paper, SegmentedControl, Select, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { DonutChart, LineChart } from '@mantine/charts';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { monthlySummary, periodReport } from '../api';
import type { MonthRow } from '../api/types';
import { useRange, RangePicker } from '../components/RangePicker';
import { formatPct, formatQty, fromMilli, toMilli } from '../lib/money';
import { useMoney } from '../lib/useSettings';
import { NetProfitSummary, RTL_X_AXIS, SalesByDayChart, netColor, rtlYAxis } from './reports/shared';

const DONUT_COLORS = ['orange.6', 'blue.6', 'teal.6', 'grape.6', 'red.6', 'yellow.6', 'cyan.6', 'pink.6', 'lime.6', 'indigo.6'];

export function ReportsPage() {
  return (
    <Stack gap="lg">
      <Title order={2}>التقارير</Title>
      <Tabs defaultValue="period" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="period">تقرير فترة</Tabs.Tab>
          <Tabs.Tab value="monthly">الملخص الشهري</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="period" pt="md">
          <PeriodReportTab />
        </Tabs.Panel>
        <Tabs.Panel value="monthly" pt="md">
          <MonthlySummaryTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

/** A compact label/value table; `strong` rows are subtotals. */
function FigureTable({ title, rows }: { title: string; rows: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <Paper withBorder p="md" radius="md" h="100%">
      <Title order={3} size="h4" mb="sm">
        {title}
      </Title>
      <Table highlightOnHover>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.label} fw={row.strong ? 700 : undefined}>
              <Table.Td>{row.label}</Table.Td>
              <Table.Td ta="end">{row.value}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

function PeriodReportTab() {
  const { fmt } = useMoney();
  const [range, setRange] = useRange();
  const { data: r } = useQuery({ queryKey: ['period_report', range], queryFn: () => periodReport(range) });

  const methods = r
    ? [
        { label: 'نقداً', milli: r.salesByMethod.cash },
        { label: 'بطاقة', milli: r.salesByMethod.card },
        { label: 'أونلاين / تطبيقات التوصيل', milli: r.salesByMethod.online },
        { label: 'أخرى', milli: r.salesByMethod.other },
      ]
    : [];
  const expensesTotal = r?.expensesByCategory.reduce((s, c) => s + c.totalMilli, 0) ?? 0;
  const profit = r?.productProfit ?? [];
  const sum = (key: 'qty' | 'revenueMilli' | 'cogsMilli' | 'grossMilli' | 'overheadMilli' | 'afterOverheadMilli') =>
    profit.reduce((s, p) => s + p[key], 0);
  const withDonut = (r?.expensesByCategory.length ?? 0) > 1;

  return (
    <Stack gap="lg">
      <RangePicker value={range} onChange={setRange} />
      {r && (
        <>
          <Paper withBorder p="lg" radius="md">
            <NetProfitSummary report={r} fmt={fmt} formula="note" />
          </Paper>

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <FigureTable
                title="المبيعات والتكاليف"
                rows={[
                  { label: 'مبيعات نقطة البيع', value: fmt(r.posSalesMilli) },
                  { label: 'المبيعات اليدوية', value: fmt(r.manualSalesMilli) },
                  { label: 'المبيعات', value: fmt(r.salesMilli), strong: true },
                  { label: 'متوسط المبيعات اليومية', value: fmt(r.avgDailySalesMilli) },
                  { label: 'المصروفات التشغيلية', value: fmt(r.operatingExpensesMilli) },
                  { label: 'مشتريات المكونات', value: fmt(r.ingredientPurchasesMilli) },
                  { label: 'مشتريات الديزل', value: fmt(r.dieselPurchasesMilli) },
                  { label: 'الرواتب', value: fmt(r.wagesMilli) },
                  { label: 'إجمالي التكاليف', value: fmt(r.totalCostsMilli), strong: true },
                ]}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <FigureTable
                title="الإنتاج والديزل"
                rows={[
                  { label: 'القطع المنتجة', value: formatQty(r.unitsProduced) },
                  { label: 'تكلفة مكونات الإنتاج', value: fmt(r.productionIngredientCostMilli) },
                  { label: 'أجور الإنتاج المستحقة', value: fmt(r.bakerPayEarnedMilli) },
                  { label: 'الديزل المستهلك (لتر)', value: formatQty(r.dieselLitersUsed) },
                  { label: 'تكلفة الديزل المستهلك', value: fmt(r.dieselCostUsedMilli) },
                  { label: 'تكلفة الديزل لكل قطعة', value: fmt(r.dieselCostPerItemMilli) },
                  { label: 'المخزون المشطوب (هدر)', value: fmt(r.stockWrittenOffMilli) },
                ]}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper withBorder p="md" radius="md" h="100%">
                <Title order={3} size="h4" mb="sm">
                  المبيعات حسب طريقة الدفع
                </Title>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>الطريقة</Table.Th>
                      <Table.Th>المبلغ</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {methods.map((m) => (
                      <Table.Tr key={m.label}>
                        <Table.Td>{m.label}</Table.Td>
                        <Table.Td>{fmt(m.milli)}</Table.Td>
                      </Table.Tr>
                    ))}
                    <Table.Tr fw={700}>
                      <Table.Td>الإجمالي</Table.Td>
                      <Table.Td>{fmt(r.salesMilli)}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Paper withBorder p="md" radius="md" h="100%">
                <Title order={3} size="h4" mb="sm">
                  المبيعات اليومية
                </Title>
                <SalesByDayChart
                  range={range}
                  days={r.salesByDay}
                  valueFormatter={(major) => fmt(toMilli(major))}
                />
              </Paper>
            </Grid.Col>
          </Grid>

          <Paper withBorder p="md" radius="md">
            <Title order={3} size="h4" mb="sm">
              المصروفات حسب الفئة
            </Title>
            {r.expensesByCategory.length === 0 ? (
              <Text c="dimmed">لا توجد مصروفات في هذه الفترة</Text>
            ) : (
              <Grid align="center">
                {withDonut && (
                  <Grid.Col span={{ base: 12, md: 5 }}>
                    <DonutChart
                      mx="auto"
                      size={200}
                      thickness={30}
                      withLabelsLine={false}
                      valueFormatter={(major) => fmt(toMilli(major))}
                      data={r.expensesByCategory.map((c, i) => ({
                        name: c.categoryName,
                        value: fromMilli(c.totalMilli),
                        color: DONUT_COLORS[i % DONUT_COLORS.length],
                      }))}
                    />
                  </Grid.Col>
                )}
                <Grid.Col span={{ base: 12, md: withDonut ? 7 : 12 }}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>الفئة</Table.Th>
                        <Table.Th>المبلغ</Table.Th>
                        <Table.Th>النسبة</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {r.expensesByCategory.map((c) => (
                        <Table.Tr key={c.categoryName}>
                          <Table.Td>{c.categoryName}</Table.Td>
                          <Table.Td>{fmt(c.totalMilli)}</Table.Td>
                          <Table.Td>{formatPct(expensesTotal > 0 ? c.totalMilli / expensesTotal : 0)}</Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr fw={700}>
                        <Table.Td>الإجمالي</Table.Td>
                        <Table.Td>{fmt(expensesTotal)}</Table.Td>
                        <Table.Td />
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Grid.Col>
              </Grid>
            )}
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Title order={3} size="h4" mb="sm">
              ربحية المنتجات
            </Title>
            <Table.ScrollContainer minWidth={800}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>المنتج</Table.Th>
                    <Table.Th>الكمية</Table.Th>
                    <Table.Th>الإيرادات</Table.Th>
                    <Table.Th>تكلفة البضاعة المباعة</Table.Th>
                    <Table.Th>الربح الإجمالي</Table.Th>
                    <Table.Th>تكاليف التشغيل المحملة</Table.Th>
                    <Table.Th>الربح بعد التشغيل</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {profit.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text c="dimmed" ta="center">
                          لا توجد مبيعات من نقطة البيع في هذه الفترة
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    <>
                      {profit.map((p) => (
                        <Table.Tr key={p.productId}>
                          <Table.Td>{p.name}</Table.Td>
                          <Table.Td>{formatQty(p.qty)}</Table.Td>
                          <Table.Td>{fmt(p.revenueMilli)}</Table.Td>
                          <Table.Td>{fmt(p.cogsMilli)}</Table.Td>
                          <Table.Td c={p.grossMilli < 0 ? 'red.8' : undefined}>{fmt(p.grossMilli)}</Table.Td>
                          <Table.Td>{fmt(p.overheadMilli)}</Table.Td>
                          <Table.Td c={netColor(p.afterOverheadMilli)}>{fmt(p.afterOverheadMilli)}</Table.Td>
                        </Table.Tr>
                      ))}
                      <Table.Tr fw={700}>
                        <Table.Td>الإجمالي</Table.Td>
                        <Table.Td>{formatQty(sum('qty'))}</Table.Td>
                        <Table.Td>{fmt(sum('revenueMilli'))}</Table.Td>
                        <Table.Td>{fmt(sum('cogsMilli'))}</Table.Td>
                        <Table.Td>{fmt(sum('grossMilli'))}</Table.Td>
                        <Table.Td>{fmt(sum('overheadMilli'))}</Table.Td>
                        <Table.Td c={netColor(sum('afterOverheadMilli'))}>{fmt(sum('afterOverheadMilli'))}</Table.Td>
                      </Table.Tr>
                    </>
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Text size="sm" c="dimmed" mt="xs">
              تشمل مبيعات نقطة البيع فقط
            </Text>
          </Paper>
        </>
      )}
    </Stack>
  );
}

/** Monthly summary columns, in table order. */
const MONTH_COLUMNS: { label: string; key: Exclude<keyof MonthRow, 'month'> }[] = [
  { label: 'المبيعات', key: 'salesMilli' },
  { label: 'المصروفات التشغيلية', key: 'operatingExpensesMilli' },
  { label: 'مشتريات المكونات', key: 'ingredientPurchasesMilli' },
  { label: 'مشتريات الديزل', key: 'dieselPurchasesMilli' },
  { label: 'الرواتب', key: 'wagesMilli' },
  { label: 'إجمالي التكاليف', key: 'totalCostsMilli' },
  { label: 'صافي الربح', key: 'netProfitMilli' },
  { label: 'هامش الربح', key: 'profitMargin' },
  { label: 'تكلفة مكونات الإنتاج', key: 'productionIngredientCostMilli' },
  { label: 'الديزل المستهلك (لتر)', key: 'dieselLitersUsed' },
  { label: 'تكلفة الديزل المستهلك', key: 'dieselCostUsedMilli' },
  { label: 'المخزون المشطوب (هدر)', key: 'stockWrittenOffMilli' },
  { label: 'أجور الإنتاج المستحقة', key: 'bakerPayEarnedMilli' },
];

/** The first 8 columns are the workbook's cash-view P&L; the rest are production and diesel detail. */
const CASH_COLUMN_COUNT = 8;

/** Keeps the month column visible while the wide table scrolls sideways. */
const STICKY = {
  position: 'sticky',
  insetInlineStart: 0,
  zIndex: 1,
  background: 'var(--mantine-color-body)',
} as const;

function MonthlySummaryTab() {
  const [detailed, setDetailed] = useState(false);
  const columns = detailed ? MONTH_COLUMNS : MONTH_COLUMNS.slice(0, CASH_COLUMN_COUNT);
  const { fmt } = useMoney();
  const currentYear = dayjs().year();
  const [year, setYear] = useState(currentYear);
  const { data: rows = [] } = useQuery({ queryKey: ['monthly_summary', year], queryFn: () => monthlySummary(year) });
  // Months after this one have no data yet; they show «—» and stay off the chart.
  const lastMonth = year < currentYear ? 12 : year > currentYear ? 0 : dayjs().month() + 1;

  const totals = Object.fromEntries(
    MONTH_COLUMNS.map(({ key }) => [key, rows.reduce((s, row) => s + row[key], 0)]),
  ) as Record<Exclude<keyof MonthRow, 'month'>, number>;
  totals.profitMargin = totals.salesMilli !== 0 ? totals.netProfitMilli / totals.salesMilli : 0;

  const cell = (key: Exclude<keyof MonthRow, 'month'>, values: Omit<MonthRow, 'month'>) => {
    const v = values[key];
    if (key === 'profitMargin') return formatPct(v);
    if (key === 'dieselLitersUsed') return formatQty(v);
    return fmt(v);
  };

  const chartData = rows
    .filter((row) => row.month <= lastMonth)
    .map((row) => ({
      month: dayjs().month(row.month - 1).format('MMMM'),
      sales: fromMilli(row.salesMilli),
      costs: fromMilli(row.totalCostsMilli),
      net: fromMilli(row.netProfitMilli),
    }));

  return (
    <Stack gap="lg">
      <Group align="flex-end" justify="space-between">
        <Select
          label="السنة"
          w={160}
          allowDeselect={false}
          data={Array.from({ length: 7 }, (_, i) => String(currentYear - 3 + i))}
          value={String(year)}
          onChange={(v) => v && setYear(Number(v))}
        />
        <SegmentedControl
          value={detailed ? 'all' : 'cash'}
          onChange={(v) => setDetailed(v === 'all')}
          data={[
            { value: 'cash', label: 'الأرباح والخسائر' },
            { value: 'all', label: 'كل الأعمدة' },
          ]}
        />
      </Group>

      <Paper withBorder p="md" radius="md">
        <Table.ScrollContainer minWidth={detailed ? 1400 : 900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={STICKY}>الشهر</Table.Th>
                {columns.map((c) => (
                  <Table.Th key={c.key}>{c.label}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.month}>
                  <Table.Td fw={600} style={STICKY}>
                    {dayjs().month(row.month - 1).format('MMMM')}
                  </Table.Td>
                  {columns.map((c) =>
                    row.month > lastMonth ? (
                      <Table.Td key={c.key} c="dimmed">
                        —
                      </Table.Td>
                    ) : (
                      <Table.Td key={c.key} c={c.key === 'netProfitMilli' ? netColor(row.netProfitMilli) : undefined}>
                        {cell(c.key, row)}
                      </Table.Td>
                    ),
                  )}
                </Table.Tr>
              ))}
              {rows.length > 0 && (
                <Table.Tr fw={700}>
                  <Table.Td style={STICKY}>الإجمالي</Table.Td>
                  {columns.map((c) => (
                    <Table.Td key={c.key} c={c.key === 'netProfitMilli' ? netColor(totals.netProfitMilli) : undefined}>
                      {cell(c.key, totals)}
                    </Table.Td>
                  ))}
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Title order={3} size="h4" mb="sm">
          المبيعات والتكاليف وصافي الربح
        </Title>
        {chartData.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            لا توجد بيانات لهذه السنة بعد
          </Text>
        ) : (
          <LineChart
            h={300}
            data={chartData}
            dataKey="month"
            withLegend
            curveType="linear"
            valueFormatter={(major) => fmt(toMilli(major))}
            xAxisProps={RTL_X_AXIS}
            yAxisProps={rtlYAxis(100)}
            series={[
              { name: 'sales', label: 'المبيعات', color: 'blue.6' },
              { name: 'costs', label: 'إجمالي التكاليف', color: 'red.6' },
              { name: 'net', label: 'صافي الربح', color: 'green.6' },
            ]}
          />
        )}
      </Paper>
    </Stack>
  );
}

import { invoiceCount } from '../lib/arabic';
import { useMemo, useState } from 'react';
import { Badge, Button, Collapse, Grid, Group, Paper, Progress, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { dashboardSnapshot, periodReport, shiftSummary } from '../api';
import { STOCK_STATUS, UNIT_LABELS } from '../api/labels';
import type { PeriodReport } from '../api/types';
import { useOpenShift } from '../components/PaymentFields';
import type { PageKey } from '../layout/AdminShell';
import { formatTime, lastNDaysRange, monthRange, todayRange, yearToDateRange } from '../lib/dates';
import { formatPct, formatQty, toMilli } from '../lib/money';
import { useMoney } from '../lib/useSettings';
import { NetProfitSummary, SalesByDayChart, StatCard, netColor } from './reports/shared';

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
  { label: 'صافي الربح', render: (r, f) => f(r.netProfitMilli), color: (r) => netColor(r.netProfitMilli) },
  { label: 'هامش الربح', render: (r) => formatPct(r.profitMargin) },
  { label: 'متوسط المبيعات اليومية', render: (r, f) => f(r.avgDailySalesMilli) },
  { label: 'تكلفة مكونات الإنتاج', render: (r, f) => f(r.productionIngredientCostMilli) },
  { label: 'الديزل المستهلك (لتر)', render: (r) => formatQty(r.dieselLitersUsed) },
  { label: 'تكلفة الديزل المستهلك', render: (r, f) => f(r.dieselCostUsedMilli) },
  { label: 'تكلفة الديزل لكل قطعة', render: (r, f) => f(r.dieselCostPerItemMilli) },
  { label: 'المخزون المشطوب (هدر)', render: (r, f) => f(r.stockWrittenOffMilli) },
  { label: 'أجور الإنتاج المستحقة', render: (r, f) => f(r.bakerPayEarnedMilli) },
];

export function DashboardPage({ onNavigate }: { onNavigate?: (page: PageKey) => void }) {
  const { fmt } = useMoney();
  const [showPnl, setShowPnl] = useState(false);
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
  const ytd = useQuery({
    queryKey: ['period_report', ranges.ytd],
    queryFn: () => periodReport(ranges.ytd),
    enabled: showPnl,
  });
  const snapshot = useQuery({ queryKey: ['dashboard_snapshot'], queryFn: dashboardSnapshot });

  const { data: openShift } = useOpenShift();
  const summary = useQuery({
    queryKey: ['shift_summary', openShift?.id],
    queryFn: () => shiftSummary(openShift!.id),
    enabled: !!openShift,
  });

  const snap = snapshot.data;
  const chartFmt = (major: number) => fmt(toMilli(major));
  const go = (page: PageKey) => (onNavigate ? () => onNavigate(page) : undefined);

  // Stock 0 with no reorder level is a never-stocked starter item, not something to buy.
  const toBuy = snap?.shoppingList.filter((i) => i.reorderQty > 0 || i.stockQty < 0) ?? [];
  const untrackedOut = (snap?.shoppingList.length ?? 0) - toBuy.length;

  return (
    <Stack gap="lg">
      <Title order={2}>لوحة التحكم</Title>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <StatCard
          label="مبيعات اليوم"
          value={today.data ? fmt(today.data.salesMilli) : '—'}
          onClick={go('sales')}
        >
          {today.data && (
            <Text size="sm" c="dimmed">
              نقطة البيع: {fmt(today.data.posSalesMilli)} • يدوي: {fmt(today.data.manualSalesMilli)}
            </Text>
          )}
        </StatCard>
        <StatCard
          label="الوردية"
          value={openShift ? 'مفتوحة' : 'لا توجد وردية مفتوحة'}
          color={openShift ? 'green.8' : 'dimmed'}
          onClick={go('shifts')}
        >
          {openShift && (
            <Text size="sm" c="dimmed">
              مفتوحة منذ {formatTime(openShift.openedAt)}
              {summary.data &&
                ` • المبيعات: ${fmt(summary.data.salesTotalMilli)} (${invoiceCount(summary.data.saleCount)})`}
            </Text>
          )}
        </StatCard>
      </SimpleGrid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="lg">
            <Paper withBorder p="md" radius="md">
              <Title order={3} size="h4" mb="sm">
                يجب شراؤه
              </Title>
              {snap && toBuy.length === 0 ? (
                <Stack gap={4}>
                  <Text c="dimmed">لا يوجد ما يجب شراؤه</Text>
                  {untrackedOut > 0 && (
                    <Text size="sm" c="dimmed">
                      حدد حد إعادة الطلب للمكونات من صفحة المخزون لتظهر هنا
                    </Text>
                  )}
                </Stack>
              ) : (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>المكوّن</Table.Th>
                      <Table.Th>المخزون</Table.Th>
                      <Table.Th>حد إعادة الطلب</Table.Th>
                      <Table.Th>الحالة</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {toBuy.map((item) => (
                      <Table.Tr key={item.name}>
                        <Table.Td fw={600}>{item.name}</Table.Td>
                        <Table.Td c={item.stockQty < 0 ? 'red.8' : undefined}>
                          {formatQty(item.stockQty)} {UNIT_LABELS[item.unit]}
                        </Table.Td>
                        <Table.Td>
                          {formatQty(item.reorderQty)} {UNIT_LABELS[item.unit]}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={STOCK_STATUS[item.status].color} variant="light">
                            {STOCK_STATUS[item.status].label}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>

            <Paper withBorder p="md" radius="md">
              <Title order={3} size="h4" mb="sm">
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
                        <Table.Td fw={600}>{p.name}</Table.Td>
                        <Table.Td c={p.stockQty < 0 ? 'red.8' : undefined}>{formatQty(p.stockQty)}</Table.Td>
                        <Table.Td>{formatQty(p.lowStockQty)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="sm">
            <Title order={3} size="h4">
              المستحقات
            </Title>
            <StatCard
              label="للموردين"
              value={snap ? fmt(snap.owedToSuppliersMilli) : '—'}
              onClick={go('purchases')}
            >
              {snap && (
                <Text size="sm" c="dimmed">
                  {snap.unpaidInvoices > 0 ? `غير مسددة: ${invoiceCount(snap.unpaidInvoices)}` : 'كل الفواتير مسددة'}
                </Text>
              )}
            </StatCard>
            <StatCard label="للخبازين" value={snap ? fmt(snap.owedToStaffMilli) : '—'} onClick={go('staff')} />
          </Stack>
        </Grid.Col>
      </Grid>

      {snap && (
        <Stack gap="sm">
          <Title order={3} size="h4">
            الوضع الحالي
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <StatCard label="قيمة المخزون" value={fmt(snap.stockValueMilli)} onClick={go('inventory')} />
            <StatCard
              label="منتجات بدون وصفة"
              value={snap.productsWithoutRecipe}
              color={snap.productsWithoutRecipe > 0 ? 'red.8' : undefined}
              onClick={go('products')}
            />
            <StatCard label="الديزل في الخزان" value={`${formatQty(snap.dieselInTankL)} لتر`} onClick={go('diesel')}>
              <Group gap="xs" mt={4} wrap="nowrap">
                <Progress
                  value={Math.max(0, Math.min(100, snap.tankLevel * 100))}
                  color={snap.tankLevel < 0.2 ? 'red' : 'orange'}
                  style={{ flex: 1 }}
                  aria-label="مستوى الخزان"
                />
                <Text size="sm">{formatPct(snap.tankLevel)}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                أيام متبقية: {snap.daysOfDieselLeft == null ? '—' : formatQty(Math.round(snap.daysOfDieselLeft * 10) / 10)}
              </Text>
            </StatCard>
          </SimpleGrid>
        </Stack>
      )}

      <Paper withBorder p="md" radius="md">
        <Title order={3} size="h4" mb="sm">
          مبيعات آخر 7 أيام
        </Title>
        {week.data && (
          <SalesByDayChart range={ranges.week} days={week.data.salesByDay} valueFormatter={chartFmt} h={220} />
        )}
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="sm">
          <Title order={3} size="h4">
            الأرباح هذا الشهر
          </Title>
          <Button
            variant="subtle"
            size="compact-sm"
            rightSection={showPnl ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            onClick={() => setShowPnl((v) => !v)}
            aria-expanded={showPnl}
          >
            {showPnl ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
          </Button>
        </Group>
        {month.data && <NetProfitSummary report={month.data} fmt={fmt} formula="tooltip" />}
        <Collapse expanded={showPnl}>
          <Table striped highlightOnHover mt="md">
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
        </Collapse>
      </Paper>
    </Stack>
  );
}

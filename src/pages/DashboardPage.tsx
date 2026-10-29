import { invoiceCount } from '../lib/arabic';
import { useMemo, useState, type ReactNode } from 'react';
import { Badge, Box, Button, Center, Collapse, Grid, Group, Paper, Progress, ScrollArea, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import {
  IconBread,
  IconCash,
  IconChevronDown,
  IconChevronUp,
  IconClockHour4,
  IconShoppingBag,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react';
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

/** Pastel rounded-square icon thumbnail for list rows. */
function Thumb({ color, icon }: { color: string; icon: ReactNode }) {
  return (
    <Center w={44} h={44} bg={color} style={{ borderRadius: 'var(--mantine-radius-md)', flexShrink: 0 }} aria-hidden>
      {icon}
    </Center>
  );
}

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
      <Title order={2} fz={32} c="var(--ink)">
        لوحة التحكم
      </Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <StatCard
          label="مبيعات اليوم"
          tint="var(--pastel-lav)"
          icon={<IconCash size={20} color="var(--ink)" />}
          value={today.data ? fmt(today.data.salesMilli) : '—'}
          onClick={go('sales')}
        />
        <StatCard
          label="الوردية"
          icon={<IconClockHour4 size={20} color="var(--ink)" />}
          value={openShift ? 'مفتوحة' : 'لا توجد'}
          color={openShift ? 'green.8' : 'dimmed'}
          onClick={go('shifts')}
        >
          {openShift && (
            <Text size="sm" c="dimmed">
              منذ {formatTime(openShift.openedAt)}
              {summary.data &&
                ` • ${fmt(summary.data.salesTotalMilli)} (${invoiceCount(summary.data.saleCount)})`}
            </Text>
          )}
        </StatCard>
        <StatCard
          label="مستحق للموردين"
          icon={<IconTruckDelivery size={20} color="var(--ink)" />}
          value={snap ? fmt(snap.owedToSuppliersMilli) : '—'}
          onClick={go('purchases')}
        >
          {snap && (
            <Text size="sm" c="dimmed">
              {snap.unpaidInvoices > 0 ? `غير مسددة: ${invoiceCount(snap.unpaidInvoices)}` : 'كل الفواتير مسددة'}
            </Text>
          )}
        </StatCard>
        <StatCard
          label="مستحق للخبازين"
          icon={<IconUsers size={20} color="var(--ink)" />}
          value={snap ? fmt(snap.owedToStaffMilli) : '—'}
          onClick={go('staff')}
        />
      </SimpleGrid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper withBorder p="lg" radius="lg" h="100%">
            <Group justify="space-between" mb="md">
              <Title order={3} size="h4">
                يجب شراؤه
              </Title>
              {onNavigate && (
                <Button variant="subtle" color="dark" size="compact-sm" onClick={() => onNavigate('inventory')}>
                  عرض الكل
                </Button>
              )}
            </Group>
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
              <ScrollArea.Autosize mah={300}>
                <Stack gap="sm">
                  {toBuy.map((item) => (
                    <Group key={item.name} wrap="nowrap" gap="md">
                      <Thumb color="var(--pastel-mint)" icon={<IconShoppingBag size={20} color="var(--ink)" />} />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={600} truncate>
                          {item.name}
                        </Text>
                        <Text size="sm" c={item.stockQty < 0 ? 'red.8' : 'dimmed'}>
                          المخزون {formatQty(item.stockQty)} {UNIT_LABELS[item.unit]} • حد الطلب {formatQty(item.reorderQty)}{' '}
                          {UNIT_LABELS[item.unit]}
                        </Text>
                      </Box>
                      <Badge color={STOCK_STATUS[item.status].color} variant="light">
                        {STOCK_STATUS[item.status].label}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper withBorder p="lg" radius="lg" h="100%">
            <Title order={3} size="h4" mb="md">
              منتجات منخفضة المخزون
            </Title>
            {snap && snap.lowStockProducts.length === 0 ? (
              <Text c="dimmed">لا يوجد نقص</Text>
            ) : (
              <ScrollArea.Autosize mah={300}>
                <Stack gap="sm">
                  {snap?.lowStockProducts.map((p) => (
                    <Group key={p.id} wrap="nowrap" gap="md">
                      <Thumb color="var(--pastel-pink)" icon={<IconBread size={20} color="var(--ink)" />} />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={600} truncate>
                          {p.name}
                        </Text>
                        <Text size="sm" c="dimmed">
                          حد التنبيه {formatQty(p.lowStockQty)}
                        </Text>
                      </Box>
                      <Text fw={700} c={p.stockQty < 0 ? 'red.8' : undefined}>
                        {formatQty(p.stockQty)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Paper>
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

      <Paper withBorder p="lg" radius="lg">
        <Title order={3} size="h4" mb="md">
          مبيعات آخر 7 أيام
        </Title>
        {week.data && (
          <SalesByDayChart range={ranges.week} days={week.data.salesByDay} valueFormatter={chartFmt} h={220} />
        )}
      </Paper>

      <Paper withBorder p="lg" radius="lg">
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

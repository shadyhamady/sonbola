import type { ReactNode } from 'react';
import { ActionIcon, Center, Group, Paper, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import { useHover } from '@mantine/hooks';
import { IconChevronLeft, IconInfoCircle } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { DaySales, PeriodReport, Range } from '../../api/types';
import { formatPct, fromMilli } from '../../lib/money';

/** Ranges up to this many days get a bar for every day (missing days = 0). */
const MAX_FILLED_DAYS = 92;

export const NET_PROFIT_FORMULA =
  'صافي الربح (نقدي) = المبيعات − (المصروفات التشغيلية + مشتريات المكونات + مشتريات الديزل + الرواتب)';

/** Text color for a profit figure: green when positive, red when negative, neutral at zero. */
export function netColor(milli: number): string | undefined {
  if (milli > 0) return 'green.8';
  if (milli < 0) return 'red.8';
  return undefined;
}

/** Recharts axis props so time runs right-to-left (oldest on the right) with values on the right edge. */
export const RTL_X_AXIS = { reversed: true } as const;
export function rtlYAxis(width: number) {
  return {
    orientation: 'right' as const,
    width,
    tick: { transform: 'translate(10, 0)', fontSize: 12, fill: 'currentColor' },
  };
}

export function StatCard({
  label,
  value,
  color,
  children,
  onClick,
  tint,
  icon,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  children?: ReactNode;
  /** Makes the whole card a button (e.g. to open the page behind the figure). */
  onClick?: () => void;
  /** Pastel fill (any CSS colour, e.g. `var(--pastel-lav)`); default is white with a thin border. */
  tint?: string;
  /** Optional icon shown in a white circle at the top. */
  icon?: ReactNode;
}) {
  const { hovered, ref } = useHover<HTMLButtonElement>();
  const body = (
    <Paper
      withBorder={!tint}
      p="lg"
      radius="lg"
      h="100%"
      bg={tint ?? (onClick && hovered ? 'var(--mantine-color-gray-0)' : 'white')}
      style={{ borderColor: '#ececf1', color: 'var(--ink)' }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs" mb="sm">
        <Group gap="xs" wrap="nowrap">
          {icon && (
            <Center w={36} h={36} bg="white" style={{ borderRadius: '50%', border: '1px solid #ececf1' }} aria-hidden>
              {icon}
            </Center>
          )}
          <Text size="sm" fw={500} c={tint ? 'var(--ink)' : 'dimmed'}>
            {label}
          </Text>
        </Group>
        {onClick && <IconChevronLeft size={16} color={tint ? 'var(--ink)' : 'var(--mantine-color-dimmed)'} aria-hidden />}
      </Group>
      <Text fw={700} fz={30} lh={1.2} c={color}>
        {value}
      </Text>
      {children && <div style={{ color: tint ? 'var(--ink)' : undefined }}>{children}</div>}
    </Paper>
  );
  if (!onClick) return body;
  return (
    <UnstyledButton ref={ref} onClick={onClick} w="100%" h="100%" style={{ borderRadius: 'var(--mantine-radius-lg)' }}>
      {body}
    </UnstyledButton>
  );
}

/** Net profit as the dominant figure, with sales and total costs beside it. */
export function NetProfitSummary({
  report,
  fmt,
  formula,
}: {
  report: PeriodReport;
  fmt: (milli: number) => string;
  /** `tooltip`: formula behind an info icon; `note`: formula printed under the figures. */
  formula: 'tooltip' | 'note';
}) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end" gap="xl">
        <div>
          <Group gap={4} wrap="nowrap">
            <Text size="sm" c="dimmed">
              صافي الربح (نقدي)
            </Text>
            {formula === 'tooltip' && (
              <Tooltip
                label={NET_PROFIT_FORMULA}
                multiline
                w={320}
                withArrow
                events={{ hover: true, focus: true, touch: true }}
              >
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label="طريقة حساب صافي الربح">
                  <IconInfoCircle size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
          <Text fz={36} fw={700} lh={1.2} c={netColor(report.netProfitMilli)}>
            {fmt(report.netProfitMilli)}
          </Text>
          {report.salesMilli > 0 && (
            <Text size="sm" c="dimmed">
              هامش الربح: {formatPct(report.profitMargin)}
            </Text>
          )}
        </div>
        <Group gap="xl" wrap="nowrap">
          <div>
            <Text size="sm" c="dimmed">
              المبيعات
            </Text>
            <Text fw={700} size="lg">
              {fmt(report.salesMilli)}
            </Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              إجمالي التكاليف
            </Text>
            <Text fw={700} size="lg">
              {fmt(report.totalCostsMilli)}
            </Text>
          </div>
        </Group>
      </Group>
      {formula === 'note' && (
        <Text size="sm" c="dimmed">
          {NET_PROFIT_FORMULA}
        </Text>
      )}
    </Stack>
  );
}

/** Chart rows with one entry per day of `range` (missing days filled with 0), values in major units. */
function dayRows(range: Range, days: DaySales[]) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const start = dayjs(range.from).startOf('day');
  const span = dayjs(range.to).diff(start, 'day');
  const keys =
    span > 0 && span <= MAX_FILLED_DAYS
      ? Array.from({ length: span }, (_, i) => start.add(i, 'day').format('YYYY-MM-DD'))
      : days.map((d) => d.day).sort();
  return keys.map((day) => {
    const d = byDay.get(day);
    return {
      day: `${day.slice(5, 7)}/${day.slice(8, 10)}`,
      pos: fromMilli(d?.posMilli ?? 0),
      manual: fromMilli(d?.manualMilli ?? 0),
    };
  });
}

/** Sales per day (POS + manual combined), oldest day on the right. */
export function SalesByDayChart({
  range,
  days,
  valueFormatter,
  h = 260,
}: {
  range: Range;
  days: DaySales[];
  valueFormatter: (major: number) => string;
  h?: number;
}) {
  const data = dayRows(range, days).map((d) => ({ day: d.day, sales: d.pos + d.manual }));
  if (data.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        لا توجد مبيعات في هذه الفترة
      </Text>
    );
  }
  return (
    <BarChart
      h={h}
      data={data}
      dataKey="day"
      valueFormatter={valueFormatter}
      xAxisProps={RTL_X_AXIS}
      yAxisProps={rtlYAxis(90)}
      gridProps={{ strokeDasharray: '4 4' }}
      series={[{ name: 'sales', label: 'المبيعات', color: 'mint.3' }]}
    />
  );
}

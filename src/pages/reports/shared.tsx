import type { ReactNode } from 'react';
import { Paper, Text } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import dayjs from 'dayjs';
import type { DaySales, Range } from '../../api/types';
import { fromMilli } from '../../lib/money';

/** Ranges up to this many days get a bar for every day (missing days = 0). */
const MAX_FILLED_DAYS = 92;

export function StatCard({
  label,
  value,
  color,
  children,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  children?: ReactNode;
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="xl" c={color}>
        {value}
      </Text>
      {children}
    </Paper>
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

/** Stacked POS + manual sales per day. */
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
  const data = dayRows(range, days);
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
      type="stacked"
      withLegend
      valueFormatter={valueFormatter}
      yAxisProps={{ width: 90 }}
      series={[
        { name: 'pos', label: 'نقطة البيع', color: 'orange.6' },
        { name: 'manual', label: 'يدوي', color: 'blue.6' },
      ]}
    />
  );
}

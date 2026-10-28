import { useState } from 'react';
import { Button, Group } from '@mantine/core';
import { DatePickerInput, type DatesRangeValue } from '@mantine/dates';
import dayjs from 'dayjs';
import type { Range } from '../api/types';
import { monthRange, rangeFromDates, todayRange, yearRange } from '../lib/dates';

interface Props {
  value: Range;
  onChange: (range: Range) => void;
}

/** The current month: the default range for every list. */
export const useRange = () => useState<Range>(() => monthRange());

export function RangePicker({ value, onChange }: Props) {
  const [draft, setDraft] = useState<DatesRangeValue<string> | null>(null);
  return (
    <Group gap="xs" align="flex-end">
      <DatePickerInput
        type="range"
        label="الفترة"
        valueFormat="YYYY/MM/DD"
        value={draft ?? [dayjs(value.from).format('YYYY-MM-DD'), dayjs(value.to - 1).format('YYYY-MM-DD')]}
        onChange={(v) => {
          const [start, end] = v as DatesRangeValue<string>;
          if (start && end) {
            setDraft(null);
            onChange(rangeFromDates(start, end));
          } else {
            setDraft([start, end]);
          }
        }}
        w={240}
      />
      <Button variant="default" onClick={() => onChange(todayRange())}>
        اليوم
      </Button>
      <Button variant="default" onClick={() => onChange(monthRange())}>
        هذا الشهر
      </Button>
      <Button variant="default" onClick={() => onChange(yearRange())}>
        هذه السنة
      </Button>
    </Group>
  );
}

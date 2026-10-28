import dayjs, { type Dayjs } from 'dayjs';
import type { Range } from '../api/types';

type DateLike = Date | Dayjs | string | number;

export const ALL_TIME: Range = { from: 0, to: Number.MAX_SAFE_INTEGER };

export function todayRange(): Range {
  const start = dayjs().startOf('day');
  return { from: start.valueOf(), to: start.add(1, 'day').valueOf() };
}

/** The last `n` days including today. */
export function lastNDaysRange(n: number): Range {
  const end = dayjs().startOf('day').add(1, 'day');
  return { from: end.subtract(n, 'day').valueOf(), to: end.valueOf() };
}

export function monthRange(d: DateLike = new Date()): Range {
  const start = dayjs(d).startOf('month');
  return { from: start.valueOf(), to: start.add(1, 'month').valueOf() };
}

/** Jan 1 → start of next month. */
export function yearToDateRange(d: DateLike = new Date()): Range {
  const x = dayjs(d);
  return { from: x.startOf('year').valueOf(), to: x.startOf('month').add(1, 'month').valueOf() };
}

export function yearRange(d: DateLike = new Date()): Range {
  const start = dayjs(d).startOf('year');
  return { from: start.valueOf(), to: start.add(1, 'year').valueOf() };
}

/** Inclusive day range [start, end] → { from: start 00:00, to: day after end 00:00 }. */
export function rangeFromDates(start: DateLike, end: DateLike): Range {
  return {
    from: dayjs(start).startOf('day').valueOf(),
    to: dayjs(end).startOf('day').add(1, 'day').valueOf(),
  };
}

export const toLocalDateString = (d: DateLike) => dayjs(d).format('YYYY-MM-DD');

/** The selected local date combined with the current time of day, in ms. */
export function withCurrentTime(date: DateLike): number {
  const now = dayjs();
  return dayjs(date)
    .hour(now.hour())
    .minute(now.minute())
    .second(now.second())
    .millisecond(now.millisecond())
    .valueOf();
}

export const formatDateTime = (ms: number) => dayjs(ms).locale('en').format('YYYY/MM/DD HH:mm');
export const formatDate = (ms: DateLike) => dayjs(ms).locale('en').format('YYYY/MM/DD');
export const formatTime = (ms: number) => dayjs(ms).locale('en').format('HH:mm');

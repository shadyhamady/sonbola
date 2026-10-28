import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSettings } from '../api';
import { formatMoney } from './money';

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: getSettings });
}

/** Money formatter bound to the configured currency, plus the decimals for money inputs. */
export function useMoney() {
  const { data } = useSettings();
  const symbol = data?.currencySymbol ?? '';
  const decimals = data?.currencyDecimals ?? 2;
  const fmt = useCallback((milli: number) => formatMoney(milli, { symbol, decimals }), [symbol, decimals]);
  return { fmt, symbol, decimals };
}

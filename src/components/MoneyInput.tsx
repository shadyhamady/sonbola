import { NumberInput, type NumberInputProps } from '@mantine/core';
import { useMoney } from '../lib/useSettings';

/** Money entry in major units (convert with `toMilli` on submit); decimals follow the currency settings. */
export function MoneyInput(props: NumberInputProps) {
  const { symbol, decimals } = useMoney();
  return (
    <NumberInput
      decimalScale={decimals}
      min={0}
      hideControls
      thousandSeparator=","
      rightSection={<span style={{ fontSize: 12, color: 'var(--mantine-color-dimmed)' }}>{symbol}</span>}
      rightSectionWidth={44}
      {...props}
    />
  );
}

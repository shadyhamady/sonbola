import { useEffect } from 'react';
import { Checkbox, Group, Select } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { getOpenShift } from '../api';
import { METHOD_LABELS, toOptions } from '../api/labels';
import type { Method } from '../api/types';

export interface PaymentValue {
  method: Method;
  paidFromDrawer: boolean;
}

interface Props extends PaymentValue {
  onChange: (next: PaymentValue) => void;
  /** Hide the drawer checkbox (e.g. when nothing is paid now). */
  disabled?: boolean;
}

export function useOpenShift() {
  return useQuery({ queryKey: ['openShift'], queryFn: getOpenShift });
}

/** Payment method select + "pay from cash drawer" checkbox (cash with an open shift only). */
export function PaymentFields({ method, paidFromDrawer, onChange, disabled }: Props) {
  const { data: openShift } = useOpenShift();
  const drawerAllowed = method === 'cash' && !!openShift && !disabled;

  useEffect(() => {
    if (paidFromDrawer && !drawerAllowed) onChange({ method, paidFromDrawer: false });
  }, [paidFromDrawer, drawerAllowed, method, onChange]);

  return (
    <Group align="flex-end" grow>
      <Select
        label="طريقة الدفع"
        data={toOptions(METHOD_LABELS)}
        value={method}
        allowDeselect={false}
        disabled={disabled}
        onChange={(v) => v && onChange({ method: v as Method, paidFromDrawer })}
      />
      <Checkbox
        label="دفع من درج النقد"
        description={!openShift ? 'لا توجد وردية مفتوحة' : method !== 'cash' ? 'للنقد فقط' : undefined}
        checked={paidFromDrawer}
        disabled={!drawerAllowed}
        onChange={(e) => onChange({ method, paidFromDrawer: e.currentTarget.checked })}
        mb={6}
      />
    </Group>
  );
}

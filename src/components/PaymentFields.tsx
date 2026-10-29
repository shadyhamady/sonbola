import { useEffect } from 'react';
import { Checkbox } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { getOpenShift } from '../api';
import type { Method } from '../api/types';

export interface PaymentValue {
  /** Always cash: the bakery only pays in cash. Kept because the backend records a method. */
  method: Method;
  paidFromDrawer: boolean;
}

interface Props extends PaymentValue {
  onChange: (next: PaymentValue) => void;
  /** Disable the drawer checkbox (e.g. when nothing is paid now). */
  disabled?: boolean;
}

export function useOpenShift() {
  return useQuery({ queryKey: ['openShift'], queryFn: getOpenShift });
}

/** "Pay from cash drawer" checkbox; available only while a shift is open. */
export function PaymentFields({ paidFromDrawer, onChange, disabled }: Props) {
  const { data: openShift } = useOpenShift();
  const drawerAllowed = !!openShift && !disabled;

  useEffect(() => {
    if (paidFromDrawer && !drawerAllowed) onChange({ method: 'cash', paidFromDrawer: false });
  }, [paidFromDrawer, drawerAllowed, onChange]);

  return (
    <Checkbox
      label="دفع من درج النقد"
      description={!openShift ? 'لا توجد وردية مفتوحة' : undefined}
      checked={paidFromDrawer}
      disabled={!drawerAllowed}
      onChange={(e) => onChange({ method: 'cash', paidFromDrawer: e.currentTarget.checked })}
    />
  );
}

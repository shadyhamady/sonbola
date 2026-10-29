import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Button, Drawer, Group, Stack, Table, Tabs, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCash, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  deletePayrollPayment,
  listPayrollPayments,
  listStaffRates,
  setStaffRate,
  staffStatement,
} from '../../api';
import { PAY_BASIS_UNIT, PAY_MODE_LABELS, PAY_TYPE_LABELS } from '../../api/labels';
import type { Staff, StaffRate } from '../../api/types';
import { MoneyInput } from '../../components/MoneyInput';
import { RangePicker, useRange } from '../../components/RangePicker';
import { ALL_TIME, formatDate } from '../../lib/dates';
import { formatQty, fromMilli, toMilli } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';
import { PayrollModal } from './PayrollModal';

interface Props {
  staff: Staff | null;
  onClose: () => void;
}

export function StaffDrawer({ staff, onClose }: Props) {
  const isProduction = staff?.payType === 'production';
  return (
    <Drawer
      opened={!!staff}
      onClose={onClose}
      position="left"
      size="xl"
      title={
        staff && (
          <Group gap="xs">
            <Text fw={700} size="lg">
              {staff.name}
            </Text>
            <Badge variant="light">{PAY_TYPE_LABELS[staff.payType]}</Badge>
          </Group>
        )
      }
    >
      {staff && (
        <Tabs defaultValue="payroll" key={staff.id}>
          <Tabs.List mb="md">
            <Tabs.Tab value="payroll">الرواتب</Tabs.Tab>
            {isProduction && <Tabs.Tab value="statement">كشف الإنتاج</Tabs.Tab>}
            {isProduction && <Tabs.Tab value="rates">الأجور الخاصة</Tabs.Tab>}
          </Tabs.List>
          <Tabs.Panel value="payroll">
            <PayrollTab staff={staff} />
          </Tabs.Panel>
          {isProduction && (
            <Tabs.Panel value="statement">
              <StatementTab staff={staff} />
            </Tabs.Panel>
          )}
          {isProduction && (
            <Tabs.Panel value="rates">
              <RatesTab staff={staff} />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </Drawer>
  );
}

function PayrollTab({ staff }: { staff: Staff }) {
  const { fmt } = useMoney();
  const [paying, setPaying] = useState(false);
  const { data: payments = [] } = useQuery({
    queryKey: ['listPayrollPayments', staff.id],
    queryFn: () => listPayrollPayments({ staffId: staff.id, range: ALL_TIME }),
  });
  const remove = useMutate(deletePayrollPayment, 'تم الحذف');
  const total = payments.reduce((s, p) => s + p.netMilli, 0);

  const confirmDelete = (id: number) =>
    modals.openConfirmModal({
      title: 'حذف الدفعة',
      children: <Text size="sm">هل تريد حذف هذه الدفعة؟</Text>,
      labels: { confirm: 'حذف', cancel: 'إلغاء' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(id),
    });

  return (
    <Stack>
      <Group justify="space-between">
        {staff.owedMilli !== null ? (
          <Text>
            المستحق:{' '}
            <Text span fw={700} c={staff.owedMilli > 0 ? 'green.8' : staff.owedMilli < 0 ? 'orange.9' : undefined}>
              {fmt(staff.owedMilli)}
            </Text>
          </Text>
        ) : (
          <span />
        )}
        <Button leftSection={<IconCash size={18} />} onClick={() => setPaying(true)}>
          صرف راتب
        </Button>
      </Group>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>التاريخ</Table.Th>
            <Table.Th>الصافي</Table.Th>
            <Table.Th>الدرج</Table.Th>
            <Table.Th w={40} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {payments.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text c="dimmed" ta="center">
                  لا توجد دفعات
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {payments.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>
                <Text size="sm">{formatDate(p.paidAt)}</Text>
                {p.period && (
                  <Text size="xs" c="dimmed">
                    {p.period}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {fmt(p.netMilli)}
                </Text>
                {(p.bonusMilli > 0 || p.deductionsMilli > 0) && (
                  <Text size="xs" c="dimmed">
                    أساسي {fmt(p.baseMilli)}
                    {p.bonusMilli > 0 && ` + مكافأة ${fmt(p.bonusMilli)}`}
                    {p.deductionsMilli > 0 && ` − خصم ${fmt(p.deductionsMilli)}`}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {p.paidFromDrawer ? (
                  <Badge size="xs" variant="light">
                    من الدرج
                  </Badge>
                ) : (
                  '—'
                )}
              </Table.Td>
              <Table.Td>
                {!p.locked && (
                  <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete(p.id)} aria-label="حذف">
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        {payments.length > 0 && (
          <Table.Tfoot>
            <Table.Tr fw={700}>
              <Table.Td>الإجمالي</Table.Td>
              <Table.Td>{fmt(total)}</Table.Td>
              <Table.Td colSpan={2} />
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>
      {paying && <PayrollModal staff={staff} onClose={() => setPaying(false)} />}
    </Stack>
  );
}

function StatementTab({ staff }: { staff: Staff }) {
  const { fmt } = useMoney();
  const [range, setRange] = useRange();
  const { data } = useQuery({
    queryKey: ['staffStatement', staff.id, range],
    queryFn: () => staffStatement({ staffId: staff.id, range }),
  });
  const earnings = data?.earnings ?? [];

  return (
    <Stack>
      <RangePicker value={range} onChange={setRange} />
      <Group gap="xl">
        <Text>
          المكتسب في الفترة: <Text span fw={700}>{fmt(data?.earnedMilli ?? 0)}</Text>
        </Text>
        <Text>
          المدفوع في الفترة: <Text span fw={700}>{fmt(data?.paidMilli ?? 0)}</Text>
        </Text>
      </Group>
      <Table.ScrollContainer minWidth={520}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>التاريخ</Table.Th>
              <Table.Th>المنتج</Table.Th>
              <Table.Th>الحصة</Table.Th>
              <Table.Th>الأجر</Table.Th>
              <Table.Th>المبلغ</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {earnings.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center">
                    لا يوجد إنتاج في هذه الفترة
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {earnings.map((e) => (
              <Table.Tr key={e.productionId}>
                <Table.Td>{formatDate(e.producedAt)}</Table.Td>
                <Table.Td>{e.productName}</Table.Td>
                <Table.Td>
                  {e.payMode === 'none' ? '—' : `${formatQty(e.basisQty)} ${PAY_BASIS_UNIT[e.payMode]}`}
                </Table.Td>
                <Table.Td>{fmt(e.rateMilli)}</Table.Td>
                <Table.Td>{fmt(e.amountMilli)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          {earnings.length > 0 && (
            <Table.Tfoot>
              <Table.Tr fw={700}>
                <Table.Td colSpan={4}>الإجمالي</Table.Td>
                <Table.Td>{fmt(data?.earnedMilli ?? 0)}</Table.Td>
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

function RatesTab({ staff }: { staff: Staff }) {
  const { fmt } = useMoney();
  const { data: rates = [] } = useQuery({
    queryKey: ['listStaffRates', staff.id],
    queryFn: () => listStaffRates(staff.id),
  });

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        اترك الحقل فارغاً لاستخدام أجر المنتج الافتراضي. يُحفظ التغيير عند مغادرة الحقل.
      </Text>
      <Table.ScrollContainer minWidth={520}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>المنتج</Table.Th>
              <Table.Th>طريقة الأجر</Table.Th>
              <Table.Th>الأجر الافتراضي</Table.Th>
              <Table.Th>الأجر الخاص</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rates.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center">
                    لا توجد منتجات بأجر إنتاج
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {rates.map((r) => (
              <Table.Tr key={r.productId}>
                <Table.Td>{r.productName}</Table.Td>
                <Table.Td>{PAY_MODE_LABELS[r.payMode]}</Table.Td>
                <Table.Td>{fmt(r.defaultRateMilli)}</Table.Td>
                <Table.Td>
                  <OverrideInput staffId={staff.id} rate={r} placeholder={fmt(r.defaultRateMilli)} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

function OverrideInput({ staffId, rate, placeholder }: { staffId: number; rate: StaffRate; placeholder: string }) {
  const toInput = (milli: number | null) => (milli === null ? '' : fromMilli(milli));
  const [value, setValue] = useState<number | string>(toInput(rate.overrideRateMilli));
  useEffect(() => setValue(toInput(rate.overrideRateMilli)), [rate.overrideRateMilli]);
  const save = useMutate(setStaffRate, 'تم حفظ الأجر الخاص');

  const commit = () => {
    const n = Number(value);
    const next = value === '' || !(n > 0) ? null : toMilli(n);
    if (next === rate.overrideRateMilli) return;
    save.mutate({ staffId, productId: rate.productId, rateMilli: next });
  };

  return (
    <MoneyInput
      value={value}
      onChange={setValue}
      onBlur={commit}
      placeholder={placeholder}
      disabled={save.isPending}
      w={160}
    />
  );
}

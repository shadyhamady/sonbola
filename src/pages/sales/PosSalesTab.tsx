import { invoiceCount } from '../../lib/arabic';
import { Fragment, useState } from 'react';
import { ActionIcon, Badge, Button, Stack, Table, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconChevronDown, IconChevronLeft } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { listSales, voidSale } from '../../api';
import { useOpenShift } from '../../components/PaymentFields';
import { RangePicker, useRange } from '../../components/RangePicker';
import { formatDateTime } from '../../lib/dates';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';

export function PosSalesTab() {
  const { fmt } = useMoney();
  const [range, setRange] = useRange();
  const { data: sales = [] } = useQuery({ queryKey: ['list_sales', range], queryFn: () => listSales(range) });
  const { data: openShift } = useOpenShift();
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const voidMut = useMutate(voidSale, 'تم إلغاء الفاتورة');

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const active = sales.filter((s) => s.voidedAt === null);
  const totalMilli = active.reduce((sum, s) => sum + s.totalMilli, 0);
  const grossMilli = active.reduce((sum, s) => sum + s.totalMilli - s.costMilli, 0);

  return (
    <Stack>
      <RangePicker value={range} onChange={setRange} />
      <Table.ScrollContainer minWidth={700}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40} />
              <Table.Th>الرقم</Table.Th>
              <Table.Th>الوقت</Table.Th>
              <Table.Th>الأصناف</Table.Th>
              <Table.Th>الإجمالي</Table.Th>
              <Table.Th>الربح الإجمالي</Table.Th>
              <Table.Th>الحالة</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sales.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" ta="center">
                    لا توجد فواتير في هذه الفترة
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {sales.map((s) => {
              const voided = s.voidedAt !== null;
              const isOpen = expanded.has(s.id);
              return (
                <Fragment key={s.id}>
                  <Table.Tr
                    style={{ cursor: 'pointer', opacity: voided ? 0.6 : 1 }}
                    onClick={() => toggle(s.id)}
                  >
                    <Table.Td>
                      <ActionIcon variant="subtle" color="gray" size="sm" aria-label="تفاصيل">
                        {isOpen ? <IconChevronDown size={16} /> : <IconChevronLeft size={16} />}
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td>{s.id}</Table.Td>
                    <Table.Td>{formatDateTime(s.createdAt)}</Table.Td>
                    <Table.Td>{s.items.map((i) => `${i.productName} × ${i.qty}`).join('، ')}</Table.Td>
                    <Table.Td td={voided ? 'line-through' : undefined}>{fmt(s.totalMilli)}</Table.Td>
                    <Table.Td td={voided ? 'line-through' : undefined}>{fmt(s.totalMilli - s.costMilli)}</Table.Td>
                    <Table.Td>
                      {voided ? (
                        <Badge color="red" variant="light">
                          ملغاة
                        </Badge>
                      ) : (
                        <Badge color="green" variant="light">
                          مكتملة
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {!voided && openShift?.id === s.shiftId && (
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          loading={voidMut.isPending && voidMut.variables === s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            modals.openConfirmModal({
                              title: 'إلغاء الفاتورة',
                              children: <Text size="sm">{`هل تريد إلغاء الفاتورة رقم ${s.id}؟ ستتم إعادة الكميات إلى المخزون.`}</Text>,
                              labels: { confirm: 'إلغاء الفاتورة', cancel: 'تراجع' },
                              confirmProps: { color: 'red' },
                              onConfirm: () => voidMut.mutate(s.id),
                            });
                          }}
                        >
                          إلغاء الفاتورة
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                  {isOpen && (
                    <Table.Tr>
                      <Table.Td colSpan={8} bg="var(--mantine-color-gray-0)">
                        <Table withRowBorders={false} verticalSpacing={4}>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>المنتج</Table.Th>
                              <Table.Th>الكمية</Table.Th>
                              <Table.Th>سعر الوحدة</Table.Th>
                              <Table.Th>تكلفة الوحدة</Table.Th>
                              <Table.Th>الإجمالي</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {s.items.map((i) => (
                              <Table.Tr key={i.id}>
                                <Table.Td>{i.productName}</Table.Td>
                                <Table.Td>{i.qty}</Table.Td>
                                <Table.Td>{fmt(i.unitPriceMilli)}</Table.Td>
                                <Table.Td>{fmt(i.unitCostMilli)}</Table.Td>
                                <Table.Td>{fmt(i.lineTotalMilli)}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                        {voided && (
                          <Text size="sm" c="red.8" mt={4}>
                            {`أُلغيت في ${formatDateTime(s.voidedAt!)}`}
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Fragment>
              );
            })}
          </Table.Tbody>
          {active.length > 0 && (
            <Table.Tfoot>
              <Table.Tr fw={700}>
                <Table.Td />
                <Table.Td colSpan={3}>{`الإجمالي (${invoiceCount(active.length)})`}</Table.Td>
                <Table.Td>{fmt(totalMilli)}</Table.Td>
                <Table.Td>{fmt(grossMilli)}</Table.Td>
                <Table.Td colSpan={2} />
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

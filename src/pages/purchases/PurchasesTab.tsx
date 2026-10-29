import { Fragment, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCash, IconChevronDown, IconChevronLeft, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { deletePurchase, deletePurchasePayment, listPurchases, listSuppliers } from '../../api';
import { PURCHASE_STATUS, UNIT_LABELS } from '../../api/labels';
import type { Purchase } from '../../api/types';
import { RangePicker, useRange } from '../../components/RangePicker';
import { formatDateTime } from '../../lib/dates';
import { formatQty } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';
import { NewPurchaseModal } from './NewPurchaseForm';
import { PurchasePaymentForm } from './PurchasePaymentForm';

const NO_SUPPLIER = 'بدون مورد';

export function PurchasesTab() {
  const { fmt } = useMoney();
  const [range, setRange] = useRange();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [newOpened, setNewOpened] = useState(false);
  const [paying, setPaying] = useState<Purchase | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['list_suppliers', true],
    queryFn: () => listSuppliers(true),
  });
  const supplierFilter = supplierId ? Number(supplierId) : null;
  const { data: purchases = [] } = useQuery({
    queryKey: ['list_purchases', range, supplierFilter],
    queryFn: () => listPurchases(range, supplierFilter),
  });

  const delPurchase = useMutate(deletePurchase, 'تم حذف الفاتورة');
  const delPayment = useMutate(deletePurchasePayment, 'تم حذف الدفعة');

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirmDeletePurchase = (p: Purchase) =>
    modals.openConfirmModal({
      title: 'حذف فاتورة الشراء',
      children: (
        <Text size="sm">
          سيتم حذف الفاتورة ودفعاتها وخصم كمياتها من المخزون. هل أنت متأكد؟
        </Text>
      ),
      labels: { confirm: 'حذف', cancel: 'إلغاء' },
      confirmProps: { color: 'red' },
      onConfirm: () => delPurchase.mutate(p.id),
    });

  const confirmDeletePayment = (id: number) =>
    modals.openConfirmModal({
      title: 'حذف الدفعة',
      children: <Text size="sm">هل أنت متأكد من حذف هذه الدفعة؟</Text>,
      labels: { confirm: 'حذف', cancel: 'إلغاء' },
      confirmProps: { color: 'red' },
      onConfirm: () => delPayment.mutate(id),
    });

  const totals = purchases.reduce(
    (t, p) => ({ total: t.total + p.totalMilli, paid: t.paid + p.paidMilli, balance: t.balance + p.balanceMilli }),
    { total: 0, paid: 0, balance: 0 },
  );

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Group align="flex-end">
          <RangePicker value={range} onChange={setRange} />
          <Select
            label="المورد"
            placeholder="كل الموردين"
            clearable
            searchable
            data={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
            value={supplierId}
            onChange={setSupplierId}
            w={200}
          />
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setNewOpened(true)}>
          شراء جديد
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={1000}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40} />
              <Table.Th>التاريخ</Table.Th>
              <Table.Th>المورد</Table.Th>
              <Table.Th>رقم الفاتورة</Table.Th>
              <Table.Th>الإجمالي</Table.Th>
              <Table.Th>المدفوع</Table.Th>
              <Table.Th>المتبقي</Table.Th>
              <Table.Th>الحالة</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {purchases.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" ta="center">
                    لا توجد مشتريات في هذه الفترة
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {purchases.map((p) => {
              const open = expanded.has(p.id);
              return (
                <Fragment key={p.id}>
                  <Table.Tr style={{ cursor: 'pointer' }} onClick={() => toggle(p.id)}>
                    <Table.Td>
                      <ActionIcon variant="subtle" color="gray" size="sm">
                        {open ? <IconChevronDown size={16} /> : <IconChevronLeft size={16} />}
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td>{formatDateTime(p.purchasedAt)}</Table.Td>
                    <Table.Td>{p.supplierName ?? <Text c="dimmed" span>{NO_SUPPLIER}</Text>}</Table.Td>
                    <Table.Td>{p.invoiceNo}</Table.Td>
                    <Table.Td fw={600}>{fmt(p.totalMilli)}</Table.Td>
                    <Table.Td>{fmt(p.paidMilli)}</Table.Td>
                    <Table.Td c={p.balanceMilli > 0 ? 'red.8' : undefined}>{fmt(p.balanceMilli)}</Table.Td>
                    <Table.Td>
                      <Badge color={PURCHASE_STATUS[p.status].color} variant="light">
                        {PURCHASE_STATUS[p.status].label}
                      </Badge>
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Group gap={4} wrap="nowrap" justify="flex-end">
                        {p.balanceMilli > 0 && (
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconCash size={14} />}
                            onClick={() => setPaying(p)}
                          >
                            تسجيل دفعة
                          </Button>
                        )}
                        <Tooltip label="حذف الفاتورة">
                          <ActionIcon variant="subtle" color="red" onClick={() => confirmDeletePurchase(p)}>
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                  {open && (
                    <Table.Tr>
                      <Table.Td colSpan={9} bg="var(--mantine-color-gray-0)">
                        <PurchaseDetails purchase={p} onDeletePayment={confirmDeletePayment} />
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Fragment>
              );
            })}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={4}>الإجمالي</Table.Th>
              <Table.Th>{fmt(totals.total)}</Table.Th>
              <Table.Th>{fmt(totals.paid)}</Table.Th>
              <Table.Th>{fmt(totals.balance)}</Table.Th>
              <Table.Th colSpan={2} />
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Table.ScrollContainer>

      <NewPurchaseModal opened={newOpened} onClose={() => setNewOpened(false)} />
      <Modal opened={paying !== null} onClose={() => setPaying(null)} title="تسجيل دفعة">
        {paying && <PurchasePaymentForm purchase={paying} onDone={() => setPaying(null)} />}
      </Modal>
    </Stack>
  );
}

function PurchaseDetails({
  purchase,
  onDeletePayment,
}: {
  purchase: Purchase;
  onDeletePayment: (id: number) => void;
}) {
  const { fmt } = useMoney();
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" py="xs">
      <Paper withBorder p="sm">
        <Title order={3} size="h6" mb="xs">
          الأصناف
        </Title>
        <Table withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>المكوّن</Table.Th>
              <Table.Th>الكمية</Table.Th>
              <Table.Th>سعر الوحدة</Table.Th>
              <Table.Th>الإجمالي</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {purchase.items.map((i) => (
              <Table.Tr key={i.id}>
                <Table.Td>{i.ingredientName}</Table.Td>
                <Table.Td>
                  {formatQty(i.qty)} {UNIT_LABELS[i.unit]}
                </Table.Td>
                <Table.Td>{fmt(i.unitCostMilli)}</Table.Td>
                <Table.Td>{fmt(i.totalCostMilli)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {purchase.note && (
          <Text size="sm" c="dimmed" mt="xs">
            ملاحظة: {purchase.note}
          </Text>
        )}
      </Paper>
      <Paper withBorder p="sm">
        <Title order={3} size="h6" mb="xs">
          الدفعات
        </Title>
        {purchase.payments.length === 0 ? (
          <Text size="sm" c="dimmed">
            لا توجد دفعات
          </Text>
        ) : (
          <Table withRowBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>التاريخ</Table.Th>
                <Table.Th>المبلغ</Table.Th>
                <Table.Th>الدرج</Table.Th>
                <Table.Th>ملاحظة</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {purchase.payments.map((pay) => (
                <Table.Tr key={pay.id}>
                  <Table.Td>{formatDateTime(pay.paidAt)}</Table.Td>
                  <Table.Td>{fmt(pay.amountMilli)}</Table.Td>
                  <Table.Td>
                    {pay.paidFromDrawer ? (
                      <Badge size="xs" variant="light">
                        من الدرج
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </Table.Td>
                  <Table.Td>{pay.note}</Table.Td>
                  <Table.Td>
                    {pay.locked ? (
                      <Tooltip label="دفعة من وردية مغلقة">
                        <Badge size="xs" color="gray">
                          مقفلة
                        </Badge>
                      </Tooltip>
                    ) : (
                      <Tooltip label="حذف الدفعة">
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onDeletePayment(pay.id)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </SimpleGrid>
  );
}

import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Modal, Stack, Switch, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArchive, IconArchiveOff, IconPencil, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createSupplier, listSuppliers, setSupplierArchived, updateSupplier } from '../../api';
import type { Supplier } from '../../api/types';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';

export function SuppliersTab() {
  const { fmt } = useMoney();
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<{ supplier: Supplier | null } | null>(null);
  const { data: suppliers = [] } = useQuery({
    queryKey: ['list_suppliers', showArchived],
    queryFn: () => listSuppliers(showArchived),
  });
  const archive = useMutate((v: { id: number; archived: boolean }) => setSupplierArchived(v.id, v.archived));

  const sum = (f: (s: Supplier) => number) => suppliers.reduce((t, s) => t + f(s), 0);

  return (
    <Stack>
      <Group justify="space-between">
        <Switch
          label="عرض المؤرشف"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.currentTarget.checked)}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModal({ supplier: null })}>
          إضافة مورد
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={1000}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>الاسم</Table.Th>
              <Table.Th>جهة الاتصال</Table.Th>
              <Table.Th>الهاتف</Table.Th>
              <Table.Th>يورّد</Table.Th>
              <Table.Th>إجمالي المشتريات</Table.Th>
              <Table.Th>المدفوع</Table.Th>
              <Table.Th>الرصيد المستحق</Table.Th>
              <Table.Th>فواتير غير مسددة</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {suppliers.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" ta="center">
                    لا يوجد موردون
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {suppliers.map((s) => (
              <Table.Tr key={s.id} opacity={s.archived ? 0.6 : 1}>
                <Table.Td>
                  <Group gap={6}>
                    <Text fw={600}>{s.name}</Text>
                    {s.archived && (
                      <Badge size="xs" color="gray">
                        مؤرشف
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>{s.contactPerson}</Table.Td>
                <Table.Td>
                  <span dir="ltr">{s.phone}</span>
                </Table.Td>
                <Table.Td>{s.supplies}</Table.Td>
                <Table.Td>{fmt(s.totalPurchasedMilli)}</Table.Td>
                <Table.Td>{fmt(s.totalPaidMilli)}</Table.Td>
                <Table.Td c={s.balanceMilli > 0 ? 'red.8' : undefined} fw={600}>
                  {fmt(s.balanceMilli)}
                </Table.Td>
                <Table.Td>{s.unpaidInvoices}</Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="تعديل">
                      <ActionIcon variant="subtle" onClick={() => setModal({ supplier: s })}>
                        <IconPencil size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={s.archived ? 'إلغاء الأرشفة' : 'أرشفة'}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        loading={archive.isPending && archive.variables?.id === s.id}
                        onClick={() => archive.mutate({ id: s.id, archived: !s.archived })}
                      >
                        {s.archived ? <IconArchiveOff size={18} /> : <IconArchive size={18} />}
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={4}>الإجمالي</Table.Th>
              <Table.Th>{fmt(sum((s) => s.totalPurchasedMilli))}</Table.Th>
              <Table.Th>{fmt(sum((s) => s.totalPaidMilli))}</Table.Th>
              <Table.Th>{fmt(sum((s) => s.balanceMilli))}</Table.Th>
              <Table.Th>{sum((s) => s.unpaidInvoices)}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Table.ScrollContainer>

      <Modal
        opened={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.supplier ? 'تعديل مورد' : 'إضافة مورد'}
      >
        {modal && <SupplierForm supplier={modal.supplier} onDone={() => setModal(null)} />}
      </Modal>
    </Stack>
  );
}

function SupplierForm({ supplier, onDone }: { supplier: Supplier | null; onDone: () => void }) {
  const form = useForm({
    initialValues: {
      name: supplier?.name ?? '',
      contactPerson: supplier?.contactPerson ?? '',
      phone: supplier?.phone ?? '',
      supplies: supplier?.supplies ?? '',
    },
    validate: { name: (v) => (v.trim() ? null : 'أدخل اسم المورد') },
  });
  const create = useMutate(createSupplier, 'تم الحفظ', onDone);
  const update = useMutate(updateSupplier, 'تم الحفظ', onDone);

  const submit = form.onSubmit((v) => {
    const input = {
      name: v.name.trim(),
      contactPerson: v.contactPerson.trim() || null,
      phone: v.phone.trim() || null,
      supplies: v.supplies.trim() || null,
    };
    if (supplier) update.mutate({ id: supplier.id, ...input });
    else create.mutate(input);
  });

  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput label="الاسم" data-autofocus {...form.getInputProps('name')} />
        <TextInput label="جهة الاتصال" {...form.getInputProps('contactPerson')} />
        <TextInput label="الهاتف" {...form.getInputProps('phone')} />
        <TextInput label="يورّد" placeholder="مثال: دقيق، سكر" {...form.getInputProps('supplies')} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            إلغاء
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            حفظ
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

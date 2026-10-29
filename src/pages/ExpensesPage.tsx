import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Select, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCategory, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { deleteExpense, listExpenseCategories, listExpenses } from '../api';
import type { Expense } from '../api/types';
import { RangePicker, useRange } from '../components/RangePicker';
import { formatDate } from '../lib/dates';
import { useMutate } from '../lib/useMutate';
import { useMoney } from '../lib/useSettings';
import { ExpenseCategoriesModal } from './expenses/ExpenseCategoriesModal';
import { ExpenseModal } from './expenses/ExpenseModal';

export function ExpensesPage() {
  const { fmt } = useMoney();
  const [range, setRange] = useRange();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  /** undefined = closed, null = new */
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined);
  const [managingCategories, setManagingCategories] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['listExpenseCategories'],
    queryFn: listExpenseCategories,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['listExpenses', range, categoryId],
    queryFn: () => listExpenses(range, categoryId ? Number(categoryId) : null),
  });
  const remove = useMutate(deleteExpense, 'تم الحذف');
  const total = expenses.reduce((s, e) => s + e.amountMilli, 0);

  const confirmDelete = (e: Expense) =>
    modals.openConfirmModal({
      title: 'حذف المصروف',
      children: <Text size="sm">هل تريد حذف هذا المصروف؟</Text>,
      labels: { confirm: 'حذف', cancel: 'إلغاء' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(e.id),
    });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>المصروفات</Title>
        <Group>
          <Button variant="default" leftSection={<IconCategory size={18} />} onClick={() => setManagingCategories(true)}>
            إدارة الفئات
          </Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing(null)}>
            مصروف جديد
          </Button>
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        مشتريات المكونات والديزل تُسجل في المشتريات، والرواتب في صفحة الموظفين
      </Text>

      <Group align="flex-end">
        <RangePicker value={range} onChange={setRange} />
        <Select
          label="الفئة"
          placeholder="كل الفئات"
          clearable
          searchable
          data={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          value={categoryId}
          onChange={setCategoryId}
          w={200}
        />
      </Group>

      <Table.ScrollContainer minWidth={700}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>التاريخ</Table.Th>
              <Table.Th>الفئة</Table.Th>
              <Table.Th>الوصف</Table.Th>
              <Table.Th>المبلغ</Table.Th>
              <Table.Th>الدرج</Table.Th>
              <Table.Th>ملاحظة</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {expenses.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" ta="center">
                    لا توجد مصروفات في هذه الفترة
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {expenses.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>{formatDate(e.spentAt)}</Table.Td>
                <Table.Td>{e.categoryName}</Table.Td>
                <Table.Td>{e.description ?? '—'}</Table.Td>
                <Table.Td fw={600}>{fmt(e.amountMilli)}</Table.Td>
                <Table.Td>
                  {e.paidFromDrawer ? (
                    <Badge size="xs" variant="light">
                      من الدرج
                    </Badge>
                  ) : (
                    '—'
                  )}
                </Table.Td>
                <Table.Td>{e.note ?? ''}</Table.Td>
                <Table.Td>
                  {!e.locked && (
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="تعديل">
                        <ActionIcon variant="subtle" onClick={() => setEditing(e)} aria-label="تعديل">
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="حذف">
                        <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete(e)} aria-label="حذف">
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          {expenses.length > 0 && (
            <Table.Tfoot>
              <Table.Tr fw={700}>
                <Table.Td colSpan={3}>الإجمالي</Table.Td>
                <Table.Td>{fmt(total)}</Table.Td>
                <Table.Td colSpan={3} />
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Table.ScrollContainer>

      {editing !== undefined && (
        <ExpenseModal expense={editing} categories={categories} onClose={() => setEditing(undefined)} />
      )}
      <ExpenseCategoriesModal
        opened={managingCategories}
        categories={categories}
        onClose={() => setManagingCategories(false)}
      />
    </Stack>
  );
}

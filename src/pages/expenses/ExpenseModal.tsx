import { Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { createExpense, updateExpense } from '../../api';
import type { Category, Expense, Method } from '../../api/types';
import { MoneyInput } from '../../components/MoneyInput';
import { PaymentFields } from '../../components/PaymentFields';
import { toLocalDateString, withCurrentTime } from '../../lib/dates';
import { fromMilli, toMilli } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';

interface Props {
  /** null = new expense */
  expense: Expense | null;
  categories: Category[];
  onClose: () => void;
}

export function ExpenseModal({ expense, categories, onClose }: Props) {
  const form = useForm({
    initialValues: {
      date: toLocalDateString(expense ? expense.spentAt : new Date()) as string | null,
      categoryId: (expense ? String(expense.categoryId) : categories[0] ? String(categories[0].id) : null) as
        | string
        | null,
      description: expense?.description ?? '',
      amount: (expense ? fromMilli(expense.amountMilli) : '') as number | string,
      paidFromDrawer: expense?.paidFromDrawer ?? false,
      note: expense?.note ?? '',
    },
    validate: {
      date: (v) => (v ? null : 'اختر التاريخ'),
      categoryId: (v) => (v ? null : 'اختر الفئة'),
      amount: (v) => (Number(v) > 0 ? null : 'أدخل المبلغ'),
    },
  });
  const create = useMutate(createExpense, 'تم الحفظ', onClose);
  const update = useMutate(updateExpense, 'تم الحفظ', onClose);
  const v = form.values;

  return (
    <Modal opened onClose={onClose} title={expense ? 'تعديل مصروف' : 'مصروف جديد'}>
      <form
        onSubmit={form.onSubmit((values) => {
          const common = {
            categoryId: Number(values.categoryId),
            description: values.description.trim() || null,
            amountMilli: toMilli(Number(values.amount)),
            method: 'cash' as Method,
            note: values.note.trim() || null,
          };
          if (expense) {
            // Keep the original time of day when the date is unchanged.
            const spentAt =
              values.date === toLocalDateString(expense.spentAt) ? expense.spentAt : withCurrentTime(values.date!);
            update.mutate({ id: expense.id, spentAt, ...common });
          } else {
            create.mutate({ spentAt: withCurrentTime(values.date!), paidFromDrawer: values.paidFromDrawer, ...common });
          }
        })}
      >
        <Stack>
          <DatePickerInput label="التاريخ" valueFormat="YYYY/MM/DD" {...form.getInputProps('date')} />
          <Select
            label="الفئة"
            data={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            searchable
            allowDeselect={false}
            {...form.getInputProps('categoryId')}
          />
          <TextInput label="الوصف" {...form.getInputProps('description')} />
          <MoneyInput label="المبلغ" data-autofocus {...form.getInputProps('amount')} />
          {!expense && (
            <PaymentFields
              method="cash"
              paidFromDrawer={v.paidFromDrawer}
              onChange={(p) => form.setFieldValue('paidFromDrawer', p.paidFromDrawer)}
            />
          )}
          <TextInput label="ملاحظة" {...form.getInputProps('note')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              حفظ
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

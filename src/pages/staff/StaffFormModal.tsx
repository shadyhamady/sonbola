import { Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { createStaff, updateStaff } from '../../api';
import { PAY_TYPE_LABELS, toOptions } from '../../api/labels';
import type { PayType, Staff, StaffInput } from '../../api/types';
import { MoneyInput } from '../../components/MoneyInput';
import { fromMilli, toMilli } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';

interface Props {
  /** null = new staff member */
  staff: Staff | null;
  onClose: () => void;
}

export function StaffFormModal({ staff, onClose }: Props) {
  const form = useForm({
    initialValues: {
      name: staff?.name ?? '',
      role: staff?.role ?? '',
      payType: (staff?.payType ?? 'monthly') as PayType,
      rate: (staff ? fromMilli(staff.rateMilli) : 0) as number | string,
      phone: staff?.phone ?? '',
      startDate: (staff?.startDate ?? null) as string | null,
    },
    validate: {
      name: (v) => (v.trim() ? null : 'أدخل اسم الموظف'),
    },
  });
  const save = useMutate(
    async (input: StaffInput) => {
      if (input.id) await updateStaff(input);
      else await createStaff(input);
    },
    'تم الحفظ',
    onClose,
  );
  const isProduction = form.values.payType === 'production';

  return (
    <Modal opened onClose={onClose} title={staff ? 'تعديل موظف' : 'إضافة موظف'}>
      <form
        onSubmit={form.onSubmit((v) =>
          save.mutate({
            id: staff?.id ?? null,
            name: v.name.trim(),
            role: v.role.trim() || null,
            payType: v.payType,
            rateMilli: v.payType === 'production' ? 0 : toMilli(Number(v.rate) || 0),
            phone: v.phone.trim() || null,
            startDate: v.startDate || null,
          }),
        )}
      >
        <Stack>
          <TextInput label="الاسم" data-autofocus {...form.getInputProps('name')} />
          <TextInput label="الوظيفة" {...form.getInputProps('role')} />
          <Select
            label="نوع الأجر"
            data={toOptions(PAY_TYPE_LABELS)}
            allowDeselect={false}
            {...form.getInputProps('payType')}
          />
          {!isProduction && <MoneyInput label="الأجر" {...form.getInputProps('rate')} />}
          <TextInput label="الهاتف" {...form.getInputProps('phone')} />
          <DatePickerInput
            label="تاريخ البدء"
            valueFormat="YYYY/MM/DD"
            clearable
            {...form.getInputProps('startDate')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" loading={save.isPending}>
              حفظ
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

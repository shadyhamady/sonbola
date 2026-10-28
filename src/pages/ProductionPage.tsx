import {
  Alert,
  Button,
  Center,
  Grid,
  Loader,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listProducts, listStaff, previewProduction, recordProduction } from '../api';
import type { ProductionInput } from '../api/types';
import { toLocalDateString, withCurrentTime } from '../lib/dates';
import { useMutate } from '../lib/useMutate';
import { useSettings } from '../lib/useSettings';
import { ProductionHistory } from './production/ProductionHistory';
import { ProductionPreviewPanel } from './production/ProductionPreviewPanel';

interface FormValues {
  date: string | null;
  productId: string | null;
  units: number | string;
  staffIds: string[];
  note: string;
}

export function ProductionPage() {
  const { data: settings } = useSettings();
  const products = useQuery({ queryKey: ['listProducts', false], queryFn: () => listProducts(false) });
  const staff = useQuery({ queryKey: ['listStaff', false], queryFn: () => listStaff(false) });
  const bakers = (staff.data ?? []).filter((s) => s.payType === 'production');

  const form = useForm<FormValues>({
    initialValues: { date: toLocalDateString(new Date()), productId: null, units: '', staffIds: [], note: '' },
    validate: {
      date: (v) => (v ? null : 'اختر التاريخ'),
      productId: (v) => (v ? null : 'اختر المنتج'),
      units: (v) => (Number.isInteger(Number(v)) && Number(v) >= 1 ? null : 'أدخل عدداً صحيحاً أكبر من صفر'),
    },
  });
  const v = form.values;

  const units = Number(v.units);
  const inputValid = v.productId != null && v.units !== '' && Number.isInteger(units) && units >= 1;
  const input: ProductionInput = {
    productId: Number(v.productId),
    units,
    staffIds: v.staffIds.map(Number),
  };
  const preview = useQuery({
    queryKey: ['previewProduction', input],
    queryFn: () => previewProduction(input),
    enabled: inputValid,
    retry: false,
    placeholderData: keepPreviousData,
  });
  const data = inputValid ? preview.data : undefined;
  const needsWorkers = !!data && data.payMode !== 'none' && data.workers.length === 0;

  const record = useMutate(recordProduction, 'تم تسجيل الإنتاج', () => form.setValues({ units: '', note: '' }));

  const submit = form.onSubmit((values) => {
    const doRecord = () =>
      record.mutate({
        ...input,
        producedAt: withCurrentTime(values.date!),
        note: values.note.trim() || null,
      });
    if (data?.ingredients.some((i) => i.requiredQty > i.stockQty)) {
      modals.openConfirmModal({
        title: 'تأكيد الإنتاج',
        children: <Text size="sm">المخزون غير كافٍ لبعض المكونات، هل تريد المتابعة؟</Text>,
        labels: { confirm: 'متابعة', cancel: 'إلغاء' },
        onConfirm: doRecord,
      });
    } else {
      doRecord();
    }
  });

  const canSubmit = !!data && !preview.isPlaceholderData && !preview.isError && !needsWorkers;

  return (
    <Stack>
      <Title order={2}>الإنتاج</Title>
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="md">
            <form onSubmit={submit}>
              <Stack>
                <DatePickerInput label="التاريخ" valueFormat="YYYY/MM/DD" {...form.getInputProps('date')} />
                <Select
                  label="المنتج"
                  placeholder="اختر المنتج"
                  searchable
                  data={(products.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))}
                  {...form.getInputProps('productId')}
                />
                <NumberInput
                  label="الكمية المنتجة"
                  min={1}
                  allowDecimal={false}
                  allowNegative={false}
                  {...form.getInputProps('units')}
                />
                <MultiSelect
                  label="الخبازون"
                  placeholder={
                    v.staffIds.length > 0 ? undefined : settings?.defaultBakerId != null ? 'الخباز الافتراضي' : 'اختر الخبازين'
                  }
                  data={bakers.map((s) => ({ value: String(s.id), label: s.name }))}
                  searchable
                  clearable
                  {...form.getInputProps('staffIds')}
                />
                <TextInput label="ملاحظة" {...form.getInputProps('note')} />
                {needsWorkers && (
                  <Text c="red" size="sm">
                    اختر خبازاً واحداً على الأقل
                  </Text>
                )}
                <Button type="submit" loading={record.isPending} disabled={!canSubmit}>
                  تسجيل الإنتاج
                </Button>
              </Stack>
            </form>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder p="md" h="100%">
            <Title order={4} mb="sm">
              معاينة التكلفة
            </Title>
            {!inputValid ? (
              <Text c="dimmed">اختر المنتج وأدخل الكمية لعرض المكونات والتكلفة</Text>
            ) : preview.isError ? (
              <Alert color="red" variant="light">
                {String(preview.error)}
              </Alert>
            ) : data ? (
              <ProductionPreviewPanel preview={data} />
            ) : (
              <Center p="xl">
                <Loader />
              </Center>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
      <ProductionHistory />
    </Stack>
  );
}

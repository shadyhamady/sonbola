import {
  Alert,
  Button,
  Center,
  Grid,
  Loader,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
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
import { getRecipe, listProducts, listStaff, previewProduction, recordProduction } from '../api';
import { UNIT_LABELS, isCountUnit } from '../api/labels';
import type { ProductionEntryUnit, ProductionInput } from '../api/types';
import { toLocalDateString, withCurrentTime } from '../lib/dates';
import { useMutate } from '../lib/useMutate';
import { useSettings } from '../lib/useSettings';
import { ProductionHistory } from './production/ProductionHistory';
import { ProductionPreviewPanel } from './production/ProductionPreviewPanel';

interface FormValues {
  date: string | null;
  productId: string | null;
  unit: ProductionEntryUnit;
  /** kg only: recipe ingredient to count; '' = full dough weight. */
  basisId: string;
  units: number | string;
  staffIds: string[];
  note: string;
}

export function ProductionPage() {
  const { data: settings } = useSettings();
  const products = useQuery({ queryKey: ['listProducts', false], queryFn: () => listProducts(false) });
  const staff = useQuery({ queryKey: ['listStaff', false], queryFn: () => listStaff(false) });
  const bakers = (staff.data ?? []).filter((s) => s.payType === 'production');
  // Only a count-unit product entered in its own unit must be a whole number.
  const needsWhole = (values: FormValues) => {
    const product = (products.data ?? []).find((p) => String(p.id) === values.productId);
    return values.unit === 'units' && !!product && isCountUnit(product.unit);
  };

  const form = useForm<FormValues>({
    initialValues: {
      date: toLocalDateString(new Date()),
      productId: null,
      unit: 'units',
      basisId: '',
      units: '',
      staffIds: [],
      note: '',
    },
    validate: {
      date: (v) => (v ? null : 'اختر التاريخ'),
      productId: (v) => (v ? null : 'اختر المنتج'),
      units: (val, values) =>
        Number(val) > 0 && (!needsWhole(values) || Number.isInteger(Number(val)))
          ? null
          : needsWhole(values)
            ? 'أدخل عدداً صحيحاً أكبر من صفر'
            : 'أدخل كمية أكبر من صفر',
    },
  });
  const v = form.values;
  const selectedProduct = (products.data ?? []).find((p) => String(p.id) === v.productId);
  const productUnitLabel = selectedProduct ? UNIT_LABELS[selectedProduct.unit] : 'حبة';
  const wholeOnly = needsWhole(v);

  const recipe = useQuery({
    queryKey: ['getRecipe', v.productId],
    queryFn: () => getRecipe(Number(v.productId)),
    enabled: v.productId != null,
  });
  // Ingredients measured by weight can be the basis for a kg entry.
  const basisOptions = [
    { value: '', label: 'وزن العجينة الكامل' },
    ...(recipe.data ?? [])
      .filter((l) => ['kg', 'g', 'l', 'ml'].includes(l.unit))
      .map((l) => ({ value: String(l.ingredientId), label: `${l.ingredientName} (${UNIT_LABELS[l.unit]})` })),
  ];

  // A basis picked for another product no longer applies after switching product.
  const basisId = basisOptions.some((o) => o.value === v.basisId) ? v.basisId : '';

  const qty = Number(v.units);
  const inputValid =
    v.productId != null && v.units !== '' && qty > 0 && (!wholeOnly || Number.isInteger(qty));
  const input: ProductionInput =
    v.unit === 'units'
      ? { productId: Number(v.productId), units: qty, staffIds: v.staffIds.map(Number) }
      : {
          productId: Number(v.productId),
          units: 0,
          unit: v.unit,
          quantity: qty,
          basisIngredientId: v.unit === 'kg' && basisId ? Number(basisId) : null,
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
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    وحدة الإنتاج
                  </Text>
                  <SegmentedControl
                    fullWidth
                    data={[
                      { value: 'units', label: productUnitLabel },
                      { value: 'batches', label: 'دفعة' },
                      { value: 'kg', label: 'كغ عجين' },
                    ]}
                    {...form.getInputProps('unit')}
                  />
                </div>
                {v.unit === 'kg' && (
                  <Select
                    label="الوزن المحسوب"
                    description={`يُحوَّل وزن العجين إلى ${productUnitLabel} حسب وصفة المنتج`}
                    allowDeselect={false}
                    data={basisOptions}
                    value={basisId}
                    onChange={(val) => form.setFieldValue('basisId', val ?? '')}
                  />
                )}
                <NumberInput
                  label={
                    v.unit === 'kg'
                      ? 'وزن العجين (كغ)'
                      : v.unit === 'batches'
                        ? 'عدد الدفعات'
                        : `الكمية المنتجة (${productUnitLabel})`
                  }
                  min={0}
                  allowDecimal={!wholeOnly}
                  decimalScale={3}
                  allowNegative={false}
                  hideControls={!wholeOnly}
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
                  <Text c="red.8" size="sm">
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
            <Title order={3} size="h4" mb="sm">
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

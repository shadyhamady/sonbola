import {
  ActionIcon,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { randomId } from '@mantine/hooks';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { getRecipe, listIngredients, listProductCategories, periodReport, saveProduct } from '../../api';
import { PAY_MODE_LABELS, UNIT_LABELS, toOptions } from '../../api/labels';
import type { Ingredient, PayMode, Product, RecipeLine } from '../../api/types';
import { MoneyInput } from '../../components/MoneyInput';
import { estimateUnitCosts, weightKg } from '../../lib/costing';
import { monthRange } from '../../lib/dates';
import { fromMilli, toMilli } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';

/** Select value standing for `payBasisIngredientId = null` (the full dough weight). */
const FULL_DOUGH = 'full';

const RATE_LABELS: Record<PayMode, string> = {
  none: '',
  per_unit: 'الأجر لكل قطعة',
  per_kg: 'الأجر لكل كغ',
  per_batch: 'الأجر لكل دفعة',
};

interface RecipeRow {
  key: string;
  ingredientId: string | null;
  qty: number | string;
}

interface FormValues {
  name: string;
  categoryId: string | null;
  price: number | string;
  lowStockQty: number | string;
  batchYield: number | string;
  recipe: RecipeRow[];
  payMode: PayMode;
  payRate: number | string;
  payBasis: string;
  overheadPerBatch: number | string;
}

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v) || 0);

interface Props {
  opened: boolean;
  onClose: () => void;
  /** `null` creates a new product. */
  product: Product | null;
  defaultCategoryId: number | null;
}

export function ProductModal({ opened, onClose, product, defaultCategoryId }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title={product ? `تعديل المنتج: ${product.name}` : 'منتج جديد'} size="xl">
      {product ? (
        <EditProductBody product={product} defaultCategoryId={defaultCategoryId} onDone={onClose} />
      ) : (
        <ProductForm product={null} recipe={[]} defaultCategoryId={defaultCategoryId} onDone={onClose} />
      )}
    </Modal>
  );
}

/** Mounted only while the modal is open; `gcTime: 0` makes every opening load the current recipe. */
function EditProductBody({ product, defaultCategoryId, onDone }: Omit<FormProps, 'recipe'> & { product: Product }) {
  const recipe = useQuery({
    queryKey: ['getRecipe', product.id],
    queryFn: () => getRecipe(product.id),
    gcTime: 0,
  });
  if (!recipe.data) {
    return <Center p="xl">{recipe.error ? <Text c="red">{String(recipe.error)}</Text> : <Loader />}</Center>;
  }
  return <ProductForm product={product} recipe={recipe.data} defaultCategoryId={defaultCategoryId} onDone={onDone} />;
}

interface FormProps {
  product: Product | null;
  recipe: RecipeLine[];
  defaultCategoryId: number | null;
  onDone: () => void;
}

function ProductForm({ product, recipe, defaultCategoryId, onDone }: FormProps) {
  const { fmt } = useMoney();
  const categories = useQuery({ queryKey: ['listProductCategories'], queryFn: listProductCategories });
  const ingredients = useQuery({ queryKey: ['listIngredients', true], queryFn: () => listIngredients(true) });
  const report = useQuery({ queryKey: ['periodReport', monthRange()], queryFn: () => periodReport(monthRange()) });

  const form = useForm<FormValues>({
    initialValues: {
      name: product?.name ?? '',
      categoryId: product ? String(product.categoryId) : defaultCategoryId != null ? String(defaultCategoryId) : null,
      price: product ? fromMilli(product.priceMilli) : '',
      lowStockQty: product?.lowStockQty ?? 0,
      batchYield: product?.batchYield ?? 1,
      recipe: recipe.map((r) => ({ key: randomId(), ingredientId: String(r.ingredientId), qty: r.qty })),
      payMode: product?.payMode ?? 'none',
      payRate: product && product.payRateMilli > 0 ? fromMilli(product.payRateMilli) : '',
      payBasis: product?.payBasisIngredientId != null ? String(product.payBasisIngredientId) : FULL_DOUGH,
      overheadPerBatch: product ? fromMilli(product.overheadPerBatchMilli) : 0,
    },
    validate: {
      name: (v) => (v.trim() ? null : 'أدخل اسم المنتج'),
      categoryId: (v) => (v ? null : 'اختر الفئة'),
      batchYield: (v) => (Number.isInteger(Number(v)) && Number(v) >= 1 ? null : 'أدخل عدداً صحيحاً أكبر من صفر'),
      lowStockQty: (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? null : 'أدخل عدداً صحيحاً'),
      payRate: (v, values) => (values.payMode === 'none' || num(v) > 0 ? null : 'أدخل أجر الخباز'),
    },
  });

  const save = useMutate(saveProduct, 'تم حفظ المنتج', onDone);

  const allIngredients: Ingredient[] = ingredients.data ?? [];
  const ingById = new Map(allIngredients.map((i) => [i.id, i]));
  const v = form.values;

  const recipeInput = v.recipe
    .filter((r) => r.ingredientId != null)
    .map((r) => ({ ingredientId: Number(r.ingredientId), qty: num(r.qty) }));

  // Weight-measured recipe ingredients that can be the per-KG pay basis.
  const basisOptions = [
    { value: FULL_DOUGH, label: 'وزن العجينة الكامل' },
    ...recipeInput
      .map((r) => ingById.get(r.ingredientId))
      .filter((i): i is Ingredient => !!i && weightKg(i.unit, 1) != null)
      .map((i) => ({ value: String(i.id), label: i.name })),
  ];
  const payBasisIngredientId = v.payMode === 'per_kg' && v.payBasis !== FULL_DOUGH ? Number(v.payBasis) : null;

  const costingInput = {
    batchYield: Math.max(1, Math.trunc(num(v.batchYield))),
    payMode: v.payMode,
    payRateMilli: v.payMode === 'none' ? 0 : toMilli(num(v.payRate)),
    payBasisIngredientId,
    overheadPerBatchMilli: toMilli(num(v.overheadPerBatch)),
    recipe: recipeInput,
  };
  const est = estimateUnitCosts(costingInput, allIngredients);
  const priceMilli = toMilli(num(v.price));
  const margin = priceMilli - est.full;

  const submit = form.onSubmit((values) =>
    save.mutate({
      id: product?.id ?? null,
      name: values.name.trim(),
      categoryId: Number(values.categoryId),
      priceMilli,
      batchYield: costingInput.batchYield,
      lowStockQty: Math.trunc(num(values.lowStockQty)),
      payMode: values.payMode,
      payRateMilli: costingInput.payRateMilli,
      payBasisIngredientId,
      overheadPerBatchMilli: costingInput.overheadPerBatchMilli,
      recipe: recipeInput,
    }),
  );

  const ingredientOptions = (row: RecipeRow) => {
    const usedElsewhere = new Set(v.recipe.filter((r) => r.key !== row.key).map((r) => r.ingredientId));
    return allIngredients
      .filter((i) => (!i.archived || String(i.id) === row.ingredientId) && !usedElsewhere.has(String(i.id)))
      .map((i) => ({ value: String(i.id), label: i.name }));
  };

  return (
    <form onSubmit={submit}>
      <Stack>
        {/* 1. Details */}
        <SimpleGrid cols={2}>
          <TextInput label="اسم المنتج" withAsterisk data-autofocus {...form.getInputProps('name')} />
          <Select
            label="الفئة"
            withAsterisk
            data={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
            {...form.getInputProps('categoryId')}
          />
          <MoneyInput label="سعر البيع" {...form.getInputProps('price')} />
          <NumberInput
            label="حد انخفاض المخزون"
            min={0}
            allowDecimal={false}
            allowNegative={false}
            {...form.getInputProps('lowStockQty')}
          />
        </SimpleGrid>

        {/* 2. Recipe */}
        <Divider />
        <Title order={4}>الوصفة</Title>
        <Group gap="xs" align="center">
          <Text>الكميات أدناه تكفي لـ</Text>
          <NumberInput
            w={100}
            min={1}
            allowDecimal={false}
            allowNegative={false}
            {...form.getInputProps('batchYield')}
          />
          <Text>قطعة</Text>
        </Group>
        {v.recipe.length === 0 && (
          <Text c="dimmed" size="sm">
            لا توجد مكونات في الوصفة
          </Text>
        )}
        {v.recipe.map((row, index) => {
          const ing = row.ingredientId ? ingById.get(Number(row.ingredientId)) : undefined;
          return (
            <Group key={row.key} gap="xs" align="flex-start" wrap="nowrap">
              <Select
                style={{ flex: 1 }}
                placeholder="اختر المكوّن"
                searchable
                data={ingredientOptions(row)}
                {...form.getInputProps(`recipe.${index}.ingredientId`)}
              />
              <NumberInput
                w={180}
                placeholder="الكمية"
                min={0}
                decimalScale={3}
                hideControls
                rightSection={
                  <Text size="xs" c="dimmed">
                    {ing ? UNIT_LABELS[ing.unit] : ''}
                  </Text>
                }
                rightSectionWidth={48}
                {...form.getInputProps(`recipe.${index}.qty`)}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                size="lg"
                aria-label="حذف"
                onClick={() => form.removeListItem('recipe', index)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          );
        })}
        <Group>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => form.insertListItem('recipe', { key: randomId(), ingredientId: null, qty: '' })}
          >
            إضافة مكوّن
          </Button>
        </Group>

        {/* 3. Baker pay */}
        <Divider />
        <Title order={4}>أجر الخبازين</Title>
        <SegmentedControl data={toOptions(PAY_MODE_LABELS)} {...form.getInputProps('payMode')} />
        {v.payMode !== 'none' && (
          <SimpleGrid cols={2}>
            <MoneyInput label={RATE_LABELS[v.payMode]} withAsterisk {...form.getInputProps('payRate')} />
            {v.payMode === 'per_kg' && (
              <Select
                label="أساس الوزن"
                data={basisOptions}
                allowDeselect={false}
                {...form.getInputProps('payBasis')}
              />
            )}
          </SimpleGrid>
        )}
        <Text size="sm" c="dimmed">
          يمكن تحديد أجر خاص لكل خباز من صفحة الموظفين
        </Text>

        {/* 4. Operating costs */}
        <Divider />
        <Title order={4}>تكاليف التشغيل</Title>
        <MoneyInput
          label="تكلفة تشغيل تقديرية لكل دفعة"
          description={`تكلفة الديزل الفعلية لكل قطعة هذا الشهر: ${fmt(report.data?.dieselCostPerItemMilli ?? 0)}`}
          w={320}
          {...form.getInputProps('overheadPerBatch')}
        />

        {/* Live per-unit cost summary */}
        <Paper withBorder p="sm" bg="var(--mantine-color-gray-0)">
          <Text fw={600} mb="xs">
            تكلفة القطعة الواحدة (تقديرية)
          </Text>
          <SimpleGrid cols={5}>
            <CostCell label="المكونات" value={fmt(est.ingredient)} />
            <CostCell label="أجر الخباز" value={fmt(est.labor)} />
            <CostCell label="التشغيل" value={fmt(est.overhead)} />
            <CostCell label="التكلفة الكاملة" value={fmt(est.full)} bold />
            <CostCell label="الهامش" value={fmt(margin)} color={margin < 0 ? 'red' : 'green'} bold />
          </SimpleGrid>
        </Paper>

        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            إلغاء
          </Button>
          <Button type="submit" loading={save.isPending}>
            حفظ
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

function CostCell({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={bold ? 700 : 500} c={color}>
        {value}
      </Text>
    </div>
  );
}

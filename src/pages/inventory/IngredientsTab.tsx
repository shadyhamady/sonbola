import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArchive, IconArchiveOff, IconPencil, IconPlus, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createIngredient, listIngredients, setIngredientArchived, updateIngredient } from '../../api';
import { STOCK_STATUS, UNIT_LABELS, toOptions } from '../../api/labels';
import type { Ingredient, Unit } from '../../api/types';
import { MoneyInput } from '../../components/MoneyInput';
import { normalizeArabic } from '../../lib/arabic';
import { fromMilli, formatQty, toMilli } from '../../lib/money';
import { useMutate } from '../../lib/useMutate';
import { useMoney } from '../../lib/useSettings';

export function IngredientsTab() {
  const { fmt } = useMoney();
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<{ ingredient: Ingredient | null } | null>(null);
  const [search, setSearch] = useState('');
  const { data: ingredients = [] } = useQuery({
    queryKey: ['list_ingredients', showArchived],
    queryFn: () => listIngredients(showArchived),
  });
  const archive = useMutate((v: { id: number; archived: boolean }) => setIngredientArchived(v.id, v.archived));

  const query = normalizeArabic(search);
  const shown = query ? ingredients.filter((i) => normalizeArabic(i.name).includes(query)) : ingredients;
  const totalValue = shown.reduce((s, i) => s + i.stockValueMilli, 0);

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <TextInput
            placeholder="بحث بالاسم"
            aria-label="بحث بالاسم"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={240}
          />
          <Switch
            label="عرض المؤرشف"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.currentTarget.checked)}
          />
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModal({ ingredient: null })}>
          إضافة مكوّن
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>الاسم</Table.Th>
              <Table.Th>الوحدة</Table.Th>
              <Table.Th>حد إعادة الطلب</Table.Th>
              <Table.Th>المخزون</Table.Th>
              <Table.Th>متوسط التكلفة</Table.Th>
              <Table.Th>قيمة المخزون</Table.Th>
              <Table.Th>الحالة</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {shown.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" ta="center">
                    {ingredients.length === 0 ? 'لا توجد مكونات' : 'لا توجد نتائج مطابقة'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {shown.map((i) => (
              <Table.Tr key={i.id} opacity={i.archived ? 0.6 : 1}>
                <Table.Td>
                  <Group gap={6}>
                    <Text fw={600}>{i.name}</Text>
                    {i.archived && (
                      <Badge size="xs" color="gray">
                        مؤرشف
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>{UNIT_LABELS[i.unit]}</Table.Td>
                <Table.Td>{formatQty(i.reorderQty)}</Table.Td>
                <Table.Td c={i.stockQty <= 0 ? 'red.8' : undefined} fw={600}>
                  {formatQty(i.stockQty)}
                </Table.Td>
                <Table.Td>{fmt(i.avgCostMilli)}</Table.Td>
                <Table.Td>{fmt(i.stockValueMilli)}</Table.Td>
                <Table.Td>
                  <Badge color={STOCK_STATUS[i.status].color} variant="light">
                    {STOCK_STATUS[i.status].label}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="تعديل">
                      <ActionIcon variant="subtle" onClick={() => setModal({ ingredient: i })}>
                        <IconPencil size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={i.archived ? 'إلغاء الأرشفة' : 'أرشفة'}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        loading={archive.isPending && archive.variables?.id === i.id}
                        onClick={() => archive.mutate({ id: i.id, archived: !i.archived })}
                      >
                        {i.archived ? <IconArchiveOff size={18} /> : <IconArchive size={18} />}
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={5}>الإجمالي</Table.Th>
              <Table.Th>{fmt(totalValue)}</Table.Th>
              <Table.Th colSpan={2} />
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Table.ScrollContainer>

      <Modal
        opened={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.ingredient ? 'تعديل مكوّن' : 'إضافة مكوّن'}
      >
        {modal && <IngredientForm ingredient={modal.ingredient} onDone={() => setModal(null)} />}
      </Modal>
    </Stack>
  );
}

function IngredientForm({ ingredient, onDone }: { ingredient: Ingredient | null; onDone: () => void }) {
  const form = useForm({
    initialValues: {
      name: ingredient?.name ?? '',
      unit: (ingredient?.unit ?? 'kg') as Unit,
      defaultCost: (ingredient ? fromMilli(ingredient.defaultCostMilli) : 0) as number | string,
      openingQty: (ingredient?.openingQty ?? 0) as number | string,
      reorderQty: (ingredient?.reorderQty ?? 0) as number | string,
    },
    validate: {
      name: (v) => (v.trim() ? null : 'أدخل الاسم'),
    },
  });
  const create = useMutate(createIngredient, 'تم الحفظ', onDone);
  const update = useMutate(updateIngredient, 'تم الحفظ', onDone);

  const submit = form.onSubmit((v) => {
    const common = {
      name: v.name.trim(),
      defaultCostMilli: toMilli(Number(v.defaultCost) || 0),
      openingQty: Number(v.openingQty) || 0,
      reorderQty: Number(v.reorderQty) || 0,
    };
    if (ingredient) update.mutate({ id: ingredient.id, ...common });
    else create.mutate({ unit: v.unit, ...common });
  });

  return (
    <form onSubmit={submit}>
      <Stack>
        <TextInput label="الاسم" data-autofocus {...form.getInputProps('name')} />
        <Select
          label="الوحدة"
          data={toOptions(UNIT_LABELS)}
          allowDeselect={false}
          disabled={!!ingredient}
          description={ingredient ? 'لا يمكن تغيير الوحدة بعد الإنشاء' : undefined}
          {...form.getInputProps('unit')}
        />
        <MoneyInput label="التكلفة الافتراضية للوحدة" {...form.getInputProps('defaultCost')} />
        <NumberInput label="الرصيد الافتتاحي" decimalScale={3} hideControls {...form.getInputProps('openingQty')} />
        <NumberInput
          label="حد إعادة الطلب"
          min={0}
          decimalScale={3}
          hideControls
          {...form.getInputProps('reorderQty')}
        />
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

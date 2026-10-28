import { useState } from 'react';
import { ActionIcon, Badge, Button, Chip, Group, Stack, Switch, Table, Text, Title, Tooltip } from '@mantine/core';
import { IconArchive, IconArchiveOff, IconCategory, IconEdit, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { listProductCategories, listProducts, setProductArchived } from '../api';
import type { Product } from '../api/types';
import { formatPct, formatQty } from '../lib/money';
import { useMutate } from '../lib/useMutate';
import { useMoney } from '../lib/useSettings';
import { CategoriesModal } from './products/CategoriesModal';
import { ProductModal } from './products/ProductModal';

const ALL = 'all';

export function ProductsPage() {
  const { fmt } = useMoney();
  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [modal, setModal] = useState<{ opened: boolean; product: Product | null }>({ opened: false, product: null });

  const categories = useQuery({ queryKey: ['listProductCategories'], queryFn: listProductCategories });
  const products = useQuery({ queryKey: ['listProducts', showArchived], queryFn: () => listProducts(showArchived) });
  const archive = useMutate(
    ({ id, archived }: { id: number; archived: boolean }) => setProductArchived(id, archived),
    'تم التحديث',
  );

  const rows = (products.data ?? []).filter(
    (p) => categoryFilter === ALL || p.categoryId === Number(categoryFilter),
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>المنتجات والوصفات</Title>
        <Group>
          <Button variant="default" leftSection={<IconCategory size={18} />} onClick={() => setCategoriesOpen(true)}>
            إدارة الفئات
          </Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setModal({ opened: true, product: null })}>
            منتج جديد
          </Button>
        </Group>
      </Group>

      <Group justify="space-between">
        <Chip.Group value={categoryFilter} onChange={setCategoryFilter}>
          <Group gap="xs">
            <Chip value={ALL}>الكل</Chip>
            {(categories.data ?? []).map((c) => (
              <Chip key={c.id} value={String(c.id)}>
                {c.name}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
        <Switch
          label="عرض المؤرشف"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.currentTarget.checked)}
        />
      </Group>

      <Table.ScrollContainer minWidth={820}>
        <Table striped highlightOnHover verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>المنتج</Table.Th>
              <Table.Th>الفئة</Table.Th>
              <Table.Th>السعر</Table.Th>
              <Table.Th>المخزون</Table.Th>
              <Table.Th>تكلفة القطعة</Table.Th>
              <Table.Th>الهامش</Table.Th>
              <Table.Th>الوصفة</Table.Th>
              <Table.Th>الكمية المنتجة</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((p) => {
              const margin = p.priceMilli - p.fullUnitCostMilli;
              return (
                <Table.Tr
                  key={p.id}
                  opacity={p.archived ? 0.55 : 1}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setModal({ opened: true, product: p })}
                >
                  <Table.Td fw={600}>
                    {p.name}
                    {p.archived && (
                      <Badge ms="xs" size="xs" color="gray">
                        مؤرشف
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{p.categoryName}</Table.Td>
                  <Table.Td>
                    {p.priceMilli === 0 ? (
                      <Badge color="orange" variant="light">
                        بدون سعر
                      </Badge>
                    ) : (
                      fmt(p.priceMilli)
                    )}
                  </Table.Td>
                  <Table.Td c={p.stockQty < 0 ? 'red' : undefined}>{formatQty(p.stockQty)}</Table.Td>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {fmt(p.fullUnitCostMilli)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      مكونات {fmt(p.ingredientCostPerUnitMilli)} • أجر {fmt(p.laborCostPerUnitMilli)} • تشغيل{' '}
                      {fmt(p.overheadPerUnitMilli)}
                    </Text>
                  </Table.Td>
                  <Table.Td c={margin < 0 ? 'red' : undefined}>
                    <Text size="sm" fw={600} c="inherit">
                      {fmt(margin)}
                    </Text>
                    <Text size="xs" c={margin < 0 ? 'red' : 'dimmed'}>
                      {p.priceMilli > 0 ? formatPct(margin / p.priceMilli) : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {p.recipeLineCount === 0 ? (
                      <Badge color="red" variant="light">
                        بدون وصفة
                      </Badge>
                    ) : (
                      p.recipeLineCount
                    )}
                  </Table.Td>
                  <Table.Td>{formatQty(p.producedUnits)}</Table.Td>
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="تعديل">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => setModal({ opened: true, product: p })}
                          aria-label="تعديل"
                        >
                          <IconEdit size={18} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={p.archived ? 'إلغاء الأرشفة' : 'أرشفة'}>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={p.archived ? 'إلغاء الأرشفة' : 'أرشفة'}
                          onClick={() => archive.mutate({ id: p.id, archived: !p.archived })}
                        >
                          {p.archived ? <IconArchiveOff size={18} /> : <IconArchive size={18} />}
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" ta="center" py="md">
                    {products.isLoading ? 'جارٍ التحميل…' : 'لا توجد منتجات'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <CategoriesModal opened={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <ProductModal
        opened={modal.opened}
        onClose={() => setModal((m) => ({ ...m, opened: false }))}
        product={modal.product}
        defaultCategoryId={
          categoryFilter !== ALL ? Number(categoryFilter) : (categories.data?.[0]?.id ?? null)
        }
      />
    </Stack>
  );
}

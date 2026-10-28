import { type RefObject, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Flex,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { listProductCategories } from '../api';
import type { Product } from '../api/types';
import { useOpenShift } from '../components/PaymentFields';
import { normalizeArabic } from '../lib/arabic';
import { useMoney } from '../lib/useSettings';

interface Props {
  products: Product[];
  cart: Map<number, number>;
  onAdd: (productId: number) => void;
  onOpenShift: () => void;
  /** Focused by the F2 / «/» shortcuts owned by the POS screen. */
  searchRef: RefObject<HTMLInputElement | null>;
}

export function ProductGrid({ products, cart, onAdd, onOpenShift, searchRef }: Props) {
  const { fmt } = useMoney();
  const { data: openShift, isLoading: shiftLoading } = useOpenShift();
  const { data: categories = [] } = useQuery({ queryKey: ['list_product_categories'], queryFn: listProductCategories });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const sellable = products.filter((p) => !p.archived && p.priceMilli > 0);
  const sellableCategoryIds = new Set(sellable.map((p) => p.categoryId));
  const shownCategories = categories.filter((c) => sellableCategoryIds.has(c.id));
  // A category can lose its last sellable product while selected; fall back to «الكل».
  const activeCategory = shownCategories.some((c) => String(c.id) === category) ? category : 'all';
  const query = normalizeArabic(search);
  const visible = sellable.filter(
    (p) =>
      (activeCategory === 'all' || String(p.categoryId) === activeCategory) &&
      (!query || normalizeArabic(p.name).includes(query)),
  );

  return (
    <Flex direction="column" h="100%" p="md" gap="sm">
      <TextInput
        ref={searchRef}
        autoFocus
        size="md"
        placeholder="بحث عن منتج (Enter للإضافة)"
        aria-label="بحث عن منتج"
        leftSection={<IconSearch size={18} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            if (query && visible.length > 0) {
              onAdd(visible[0].id);
              setSearch('');
            }
          } else if (e.key === 'Escape' && search) {
            e.preventDefault();
            setSearch('');
          }
        }}
      />
      {shownCategories.length > 0 && (
        <Tabs value={activeCategory} onChange={(v) => setCategory(v ?? 'all')} styles={{ tab: { minHeight: 44 } }}>
          <Tabs.List>
            <Tabs.Tab value="all">الكل</Tabs.Tab>
            {shownCategories.map((c) => (
              <Tabs.Tab key={c.id} value={String(c.id)}>
                {c.name}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}
      <ScrollArea style={{ flex: 1 }}>
        {sellable.length === 0 ? (
          <Center h={300}>
            <Text c="dimmed" size="lg">
              أضف أسعار المنتجات من صفحة المنتجات
            </Text>
          </Center>
        ) : visible.length === 0 ? (
          <Center h={200}>
            <Text c="dimmed">لا توجد منتجات مطابقة</Text>
          </Center>
        ) : (
          <SimpleGrid cols={{ base: 3, md: 4, lg: 5 }} spacing="sm">
            {visible.map((p) => {
              const inCart = cart.get(p.id) ?? 0;
              const remaining = p.stockQty - inCart;
              return (
                <UnstyledButton
                  key={p.id}
                  onClick={() => onAdd(p.id)}
                  aria-label={`${p.name}، ${fmt(p.priceMilli)}، متبقي ${remaining}${inCart ? `، في السلة ${inCart}` : ''}`}
                  p="sm"
                  mih={110}
                  style={{
                    border: `1px solid ${inCart ? 'var(--mantine-color-orange-5)' : 'var(--mantine-color-gray-3)'}`,
                    borderRadius: 'var(--mantine-radius-md)',
                    background: inCart ? 'var(--mantine-color-orange-0)' : 'var(--mantine-color-body)',
                  }}
                >
                  <Stack gap={6} justify="space-between" h="100%">
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap={4}>
                      <Text fw={700} size="lg" lineClamp={2}>
                        {p.name}
                      </Text>
                      {inCart > 0 && (
                        <Badge color="orange" variant="filled" size="lg" fz={14} style={{ flexShrink: 0 }} aria-label={`في السلة ${inCart}`}>
                          ×{inCart}
                        </Badge>
                      )}
                    </Group>
                    <Group justify="space-between" gap={4}>
                      <Text fw={600} c="orange.9">
                        {fmt(p.priceMilli)}
                      </Text>
                      <Badge
                        color={remaining <= 0 ? 'red' : 'gray'}
                        c={remaining <= 0 ? 'red.8' : 'gray.8'}
                        variant="light"
                        size="lg"
                        fz={13}
                      >
                        متبقي {remaining}
                      </Badge>
                    </Group>
                  </Stack>
                </UnstyledButton>
              );
            })}
          </SimpleGrid>
        )}
      </ScrollArea>
      {!shiftLoading && !openShift && (
        <Box
          pos="absolute"
          inset={0}
          style={{ zIndex: 10, background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(2px)' }}
        >
          <Center h="100%">
            <Card withBorder shadow="md" radius="lg" p="xl" w={360}>
              <Stack align="center">
                <Text size="xl" fw={700}>
                  لا توجد وردية مفتوحة
                </Text>
                <Text c="dimmed" ta="center">
                  افتح وردية لبدء البيع
                </Text>
                <Button size="lg" color="green" fullWidth onClick={onOpenShift}>
                  فتح وردية
                </Button>
              </Stack>
            </Card>
          </Center>
        </Box>
      )}
    </Flex>
  );
}

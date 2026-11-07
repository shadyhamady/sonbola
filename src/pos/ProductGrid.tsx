import { type ReactNode, type RefObject, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Card, Center, Flex, Group, ScrollArea, SimpleGrid, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconBread, IconLayoutGrid, IconMinus, IconPlus, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { listProductCategories } from '../api';
import { UNIT_LABELS, formatUnitQty, isCountUnit } from '../api/labels';
import type { Product } from '../api/types';
import { useOpenShift } from '../components/PaymentFields';
import { normalizeArabic } from '../lib/arabic';
import { formatQty } from '../lib/money';
import { pastelFor } from '../lib/pastel';
import { useMoney } from '../lib/useSettings';

interface Props {
  products: Product[];
  cart: Map<number, number>;
  onAdd: (productId: number) => void;
  onSetQty: (productId: number, qty: number) => void;
  onOpenShift: () => void;
  /** Focused by the F2 / «/» shortcuts owned by the POS screen. */
  searchRef: RefObject<HTMLInputElement | null>;
}

export function ProductGrid({ products, cart, onAdd, onSetQty, onOpenShift, searchRef }: Props) {
  const { fmt } = useMoney();
  const { data: openShift, isLoading: shiftLoading } = useOpenShift();
  const { data: categories = [] } = useQuery({ queryKey: ['list_product_categories'], queryFn: listProductCategories });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const sellable = products.filter((p) => !p.archived && p.priceMilli > 0);
  const countByCategory = new Map<number, number>();
  for (const p of sellable) countByCategory.set(p.categoryId, (countByCategory.get(p.categoryId) ?? 0) + 1);
  // Pastel follows the category's position in the full category order, so it is stable while others are hidden.
  const pastelByCategory = new Map(categories.map((c, i) => [c.id, pastelFor(i)]));
  const shownCategories = categories.filter((c) => countByCategory.has(c.id));
  // A category can lose its last sellable product while selected; fall back to «الكل».
  const activeCategory = shownCategories.some((c) => String(c.id) === category) ? category : 'all';
  const query = normalizeArabic(search);
  const visible = sellable.filter(
    (p) =>
      (activeCategory === 'all' || String(p.categoryId) === activeCategory) &&
      (!query || normalizeArabic(p.name).includes(query)),
  );

  const tile = (key: string, label: string, count: number, bg: string, icon: ReactNode) => {
    const selected = activeCategory === key;
    return (
      <UnstyledButton
        key={key}
        onClick={() => setCategory(key)}
        aria-pressed={selected}
        aria-label={`${label}، عدد الأصناف ${count}`}
        p="sm"
        miw={132}
        h={92}
        style={{
          flexShrink: 0,
          background: bg,
          color: 'var(--ink)',
          borderRadius: 'var(--mantine-radius-lg)',
          border: `2px solid ${selected ? 'var(--ink)' : 'transparent'}`,
        }}
      >
        <Stack gap={0} justify="space-between" h="100%">
          <Center
            w={30}
            h={30}
            style={{ borderRadius: '50%', background: 'rgba(255,255,255,0.7)', flexShrink: 0 }}
          >
            {icon}
          </Center>
          <div>
            <Text fw={700} lh={1.2} lineClamp={1}>
              {label}
            </Text>
            <Text size="xs" lh={1.3} style={{ color: '#4a4a55' }}>
              عدد الأصناف {count}
            </Text>
          </div>
        </Stack>
      </UnstyledButton>
    );
  };

  return (
    <Flex direction="column" h="100%" p="md" gap="sm" style={{ minHeight: 0 }}>
      {shownCategories.length > 0 && (
        <ScrollArea type="never" style={{ flexShrink: 0 }}>
          <Group gap="sm" wrap="nowrap" pb={2}>
            {tile('all', 'الكل', sellable.length, 'white', <IconLayoutGrid size={18} />)}
            {shownCategories.map((c) =>
              tile(String(c.id), c.name, countByCategory.get(c.id) ?? 0, pastelByCategory.get(c.id)!.bg, <IconBread size={18} />),
            )}
          </Group>
        </ScrollArea>
      )}
      <TextInput
        ref={searchRef}
        autoFocus
        size="md"
        radius="xl"
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
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
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
          <SimpleGrid cols={{ base: 2, md: 3, lg: 4 }} spacing="sm" pb="xs">
            {visible.map((p) => {
              const inCart = cart.get(p.id) ?? 0;
              const remaining = Math.round((p.stockQty - inCart) * 1000) / 1000;
              const pastel = pastelByCategory.get(p.categoryId) ?? pastelFor(0);
              const active = inCart > 0;
              const price = isCountUnit(p.unit) ? fmt(p.priceMilli) : `${fmt(p.priceMilli)} / ${UNIT_LABELS[p.unit]}`;
              // Pieces keep the bare number; other units name theirs.
              const remainingLabel = p.unit === 'pcs' ? formatQty(remaining) : formatUnitQty(remaining, p.unit);
              return (
                <Flex
                  key={p.id}
                  direction="column"
                  mih={132}
                  p="sm"
                  gap={6}
                  style={{
                    background: active ? pastel.bg : `color-mix(in srgb, ${pastel.bg} 35%, white)`,
                    border: '1px solid #ececf1',
                    borderRadius: 'var(--mantine-radius-lg)',
                    color: 'var(--ink)',
                  }}
                >
                  <UnstyledButton
                    onClick={() => onAdd(p.id)}
                    aria-label={`${p.name}، ${price}، متبقي ${formatUnitQty(remaining, p.unit)}${inCart ? `، في السلة ${formatUnitQty(inCart, p.unit)}` : ''}`}
                    style={{ flex: 1, textAlign: 'start' }}
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap" gap={4}>
                      <Text fw={700} size="lg" lh={1.25} lineClamp={2}>
                        {p.name}
                      </Text>
                      {active && (
                        <Badge color="dark" variant="filled" size="lg" fz={14} style={{ flexShrink: 0 }} aria-label={`في السلة ${formatUnitQty(inCart, p.unit)}`}>
                          ×{formatQty(inCart)}
                        </Badge>
                      )}
                    </Group>
                    <Group justify="space-between" gap={4} mt={4}>
                      <Text fw={500} style={{ color: '#4a4a55' }}>
                        {price}
                      </Text>
                      <Badge
                        color={remaining <= 0 ? 'red' : 'gray'}
                        c={remaining <= 0 ? 'red.8' : 'gray.8'}
                        variant={remaining <= 0 ? 'light' : 'white'}
                        size="md"
                        fz={12}
                      >
                        متبقي {remainingLabel}
                      </Badge>
                    </Group>
                  </UnstyledButton>
                  <Group gap={6} wrap="nowrap" justify="space-between">
                    <ActionIcon
                      size={44}
                      variant="white"
                      c="dark"
                      bd="1px solid #ececf1"
                      disabled={inCart <= 0}
                      onClick={() => onSetQty(p.id, inCart - 1)}
                      aria-label={`إنقاص ${p.name}`}
                    >
                      <IconMinus size={20} />
                    </ActionIcon>
                    <Text fw={700} fz={20} miw={28} ta="center">
                      {formatQty(inCart)}
                    </Text>
                    <ActionIcon
                      size={44}
                      variant="white"
                      c="dark"
                      bd="1px solid #ececf1"
                      onClick={() => onAdd(p.id)}
                      aria-label={`زيادة ${p.name}`}
                    >
                      <IconPlus size={20} />
                    </ActionIcon>
                  </Group>
                </Flex>
              );
            })}
          </SimpleGrid>
        )}
      </ScrollArea>
      {!shiftLoading && !openShift && (
        <Box
          pos="absolute"
          inset={0}
          style={{ zIndex: 10, background: 'rgba(248, 248, 251, 0.7)', backdropFilter: 'blur(2px)' }}
        >
          <Center h="100%">
            <Card withBorder radius="lg" p="xl" w={360}>
              <Stack align="center">
                <Text size="xl" fw={700}>
                  لا توجد وردية مفتوحة
                </Text>
                <Text c="dimmed" ta="center">
                  افتح وردية لبدء البيع
                </Text>
                <Button size="lg" color="dark" radius="xl" fullWidth onClick={onOpenShift}>
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

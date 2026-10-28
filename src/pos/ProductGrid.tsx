import { useState } from 'react';
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
import { useMoney } from '../lib/useSettings';

interface Props {
  products: Product[];
  cart: Map<number, number>;
  onAdd: (productId: number) => void;
  onOpenShift: () => void;
}

export function ProductGrid({ products, cart, onAdd, onOpenShift }: Props) {
  const { fmt } = useMoney();
  const { data: openShift, isLoading: shiftLoading } = useOpenShift();
  const { data: categories = [] } = useQuery({ queryKey: ['list_product_categories'], queryFn: listProductCategories });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const sellable = products.filter((p) => !p.archived && p.priceMilli > 0);
  const query = search.trim();
  const visible = sellable.filter(
    (p) => (category === 'all' || String(p.categoryId) === category) && (!query || p.name.includes(query)),
  );

  return (
    <Flex direction="column" h="100%" p="md" gap="sm">
      <TextInput
        autoFocus
        size="md"
        placeholder="بحث عن منتج"
        leftSection={<IconSearch size={18} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      <Tabs value={category} onChange={(v) => setCategory(v ?? 'all')}>
        <Tabs.List>
          <Tabs.Tab value="all">الكل</Tabs.Tab>
          {categories.map((c) => (
            <Tabs.Tab key={c.id} value={String(c.id)}>
              {c.name}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
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
              return (
                <UnstyledButton
                  key={p.id}
                  onClick={() => onAdd(p.id)}
                  p="sm"
                  mih={110}
                  style={{
                    border: `1px solid ${inCart ? 'var(--mantine-color-orange-5)' : 'var(--mantine-color-gray-3)'}`,
                    borderRadius: 'var(--mantine-radius-md)',
                    background: inCart ? 'var(--mantine-color-orange-0)' : 'var(--mantine-color-body)',
                  }}
                >
                  <Stack gap={6} justify="space-between" h="100%">
                    <Text fw={700} size="lg" lineClamp={2}>
                      {p.name}
                    </Text>
                    <Group justify="space-between" gap={4}>
                      <Text fw={600} c="orange.8">
                        {fmt(p.priceMilli)}
                      </Text>
                      <Badge color={p.stockQty <= 0 ? 'red' : 'gray'} variant="light">
                        {p.stockQty}
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

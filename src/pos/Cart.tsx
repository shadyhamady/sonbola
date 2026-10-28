import { ActionIcon, Button, Center, Divider, Flex, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { IconMinus, IconPlus, IconShoppingCart, IconTrash } from '@tabler/icons-react';
import { createSale } from '../api';
import type { Product } from '../api/types';
import { useOpenShift } from '../components/PaymentFields';
import { useMutate } from '../lib/useMutate';
import { useMoney } from '../lib/useSettings';

interface Props {
  products: Product[];
  cart: Map<number, number>;
  onSetQty: (productId: number, qty: number) => void;
  onClear: () => void;
}

export function Cart({ products, cart, onSetQty, onClear }: Props) {
  const { fmt } = useMoney();
  const { data: openShift } = useOpenShift();
  const sale = useMutate(createSale, (s) => `تمت عملية البيع رقم ${s.id} — ${fmt(s.totalMilli)}`, onClear);

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [...cart].flatMap(([productId, qty]) => {
    const product = byId.get(productId);
    return product ? [{ product, qty, totalMilli: product.priceMilli * qty }] : [];
  });
  const totalMilli = lines.reduce((sum, l) => sum + l.totalMilli, 0);

  return (
    <Flex direction="column" h="100%" bg="var(--mantine-color-gray-0)">
      <Group px="md" py="sm" gap="xs">
        <IconShoppingCart size={22} />
        <Text fw={700} size="lg">
          السلة
        </Text>
      </Group>
      <Divider />
      <ScrollArea style={{ flex: 1 }} px="sm" py="xs">
        {lines.length === 0 ? (
          <Center h={200}>
            <Text c="dimmed">السلة فارغة</Text>
          </Center>
        ) : (
          <Stack gap="xs">
            {lines.map(({ product, qty, totalMilli: lineTotal }) => (
              <Paper key={product.id} withBorder p="xs" radius="md">
                <Group justify="space-between" wrap="nowrap" mb={6}>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={700} truncate>
                      {product.name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {fmt(product.priceMilli)}
                    </Text>
                  </div>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="lg"
                    onClick={() => onSetQty(product.id, 0)}
                    aria-label="حذف"
                  >
                    <IconTrash size={20} />
                  </ActionIcon>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon size="xl" variant="default" onClick={() => onSetQty(product.id, qty - 1)} aria-label="إنقاص">
                      <IconMinus size={20} />
                    </ActionIcon>
                    <Text fw={700} size="xl" miw={36} ta="center">
                      {qty}
                    </Text>
                    <ActionIcon size="xl" variant="default" onClick={() => onSetQty(product.id, qty + 1)} aria-label="زيادة">
                      <IconPlus size={20} />
                    </ActionIcon>
                  </Group>
                  <Text fw={700}>{fmt(lineTotal)}</Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </ScrollArea>
      <Divider />
      <Stack p="md" gap="sm">
        <Group justify="space-between">
          <Text fw={600} size="lg">
            الإجمالي
          </Text>
          <Text fw={700} fz={32}>
            {fmt(totalMilli)}
          </Text>
        </Group>
        <Button
          size="xl"
          fullWidth
          color="green"
          disabled={lines.length === 0 || !openShift}
          loading={sale.isPending}
          onClick={() => sale.mutate({ items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })) })}
        >
          إتمام البيع (نقداً)
        </Button>
        <Button variant="subtle" color="gray" disabled={cart.size === 0 || sale.isPending} onClick={onClear}>
          إفراغ السلة
        </Button>
      </Stack>
    </Flex>
  );
}

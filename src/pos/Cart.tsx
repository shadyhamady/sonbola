import { ActionIcon, Button, Center, Divider, Flex, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconArrowBackUp, IconMinus, IconPlus, IconReceipt, IconShoppingCart, IconTrash } from '@tabler/icons-react';
import { voidSale } from '../api';
import type { Product, Sale } from '../api/types';
import { useOpenShift } from '../components/PaymentFields';
import { formatTime } from '../lib/dates';
import { useMutate } from '../lib/useMutate';
import { useMoney } from '../lib/useSettings';

interface Props {
  products: Product[];
  cart: Map<number, number>;
  totalMilli: number;
  onSetQty: (productId: number, qty: number) => void;
  onClear: () => void;
  canRestore: boolean;
  onRestore: () => void;
  onCheckout: () => void;
  lastSale: Sale | null;
  onLastSaleVoided: () => void;
}

export function Cart({
  products,
  cart,
  totalMilli,
  onSetQty,
  onClear,
  canRestore,
  onRestore,
  onCheckout,
  lastSale,
  onLastSaleVoided,
}: Props) {
  const { fmt } = useMoney();
  const { data: openShift } = useOpenShift();
  const voidLast = useMutate(voidSale, 'تم إلغاء الفاتورة وإرجاع المنتجات للمخزون', onLastSaleVoided);

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [...cart].flatMap(([productId, qty]) => {
    const product = byId.get(productId);
    return product ? [{ product, qty, totalMilli: product.priceMilli * qty }] : [];
  });
  // Voiding is only allowed while the sale's shift is still open.
  const voidable = lastSale && openShift && lastSale.shiftId === openShift.id ? lastSale : null;

  return (
    <Flex direction="column" h="100%" bg="var(--mantine-color-gray-0)">
      <Group px="md" py="sm" gap="xs" justify="space-between">
        <Group gap="xs">
          <IconShoppingCart size={22} />
          <Text fw={700} size="lg">
            السلة
          </Text>
        </Group>
        {/* Kept away from the checkout button: a mis-tap there must not wipe the order. */}
        <Button variant="subtle" color="gray" size="compact-sm" disabled={cart.size === 0} onClick={onClear}>
          إفراغ السلة
        </Button>
      </Group>
      <Divider />
      <ScrollArea style={{ flex: 1 }} px="sm" py="xs">
        {lines.length === 0 ? (
          <Center h={200}>
            <Stack align="center" gap="xs">
              <Text c="dimmed">السلة فارغة</Text>
              {canRestore && (
                <Button variant="light" leftSection={<IconArrowBackUp size={18} />} onClick={onRestore}>
                  استعادة السلة
                </Button>
              )}
            </Stack>
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
        {voidable && (
          <Paper withBorder radius="md" px="sm" py={6}>
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <Group gap={6} wrap="nowrap">
                <IconReceipt size={18} />
                <Text size="sm">
                  آخر فاتورة #{voidable.id} • {formatTime(voidable.createdAt)} • {fmt(voidable.totalMilli)}
                </Text>
              </Group>
              <Button
                variant="subtle"
                color="red"
                size="compact-sm"
                loading={voidLast.isPending}
                onClick={() =>
                  modals.openConfirmModal({
                    title: `إلغاء الفاتورة #${voidable.id}`,
                    children: <Text size="sm">ستُرجع المنتجات إلى المخزون ويُخصم المبلغ من مبيعات الوردية.</Text>,
                    labels: { confirm: 'إلغاء الفاتورة', cancel: 'رجوع' },
                    confirmProps: { color: 'red' },
                    onConfirm: () => voidLast.mutate(voidable.id),
                  })
                }
              >
                إلغاء
              </Button>
            </Group>
          </Paper>
        )}
        <Group justify="space-between">
          <Text fw={600} size="lg">
            الإجمالي
          </Text>
          <Text fw={700} fz={32}>
            {fmt(totalMilli)}
          </Text>
        </Group>
        <Button size="xl" fullWidth color="green" disabled={lines.length === 0 || !openShift} onClick={onCheckout}>
          إتمام البيع (نقداً)
        </Button>
      </Stack>
    </Flex>
  );
}

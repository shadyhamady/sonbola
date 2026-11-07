import { useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconArrowBackUp, IconMinus, IconPlus, IconReceipt, IconShoppingCart, IconTrash } from '@tabler/icons-react';
import { voidSale } from '../api';
import { UNIT_LABELS, formatUnitQty, isCountUnit } from '../api/labels';
import type { Product, Sale, Unit } from '../api/types';
import { useOpenShift } from '../components/PaymentFields';
import { formatTime } from '../lib/dates';
import { formatQty } from '../lib/money';
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
  /** Cart has sellable lines and a shift is open. */
  canCheckout: boolean;
  checkingOut: boolean;
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
  canCheckout,
  checkingOut,
  lastSale,
  onLastSaleVoided,
}: Props) {
  const { fmt } = useMoney();
  const { data: openShift } = useOpenShift();
  const voidLast = useMutate(voidSale, 'تم إلغاء الفاتورة وإرجاع المنتجات للمخزون', onLastSaleVoided);

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [...cart].flatMap(([productId, qty]) => {
    const product = byId.get(productId);
    // Each line rounds to whole milli, matching the backend.
    return product ? [{ product, qty, totalMilli: Math.round(product.priceMilli * qty) }] : [];
  });
  // Voiding is only allowed while the sale's shift is still open.
  const voidable = lastSale && openShift && lastSale.shiftId === openShift.id ? lastSale : null;

  return (
    <Flex direction="column" h="100%" bg="white">
      <Group px="lg" pt="lg" pb="sm" gap="xs" justify="space-between">
        <Group gap="xs">
          <IconShoppingCart size={22} />
          <Text fw={700} fz={20}>
            السلة
          </Text>
        </Group>
        {/* Kept away from the checkout button: a mis-tap there must not wipe the order. */}
        <Button variant="subtle" color="gray" c="dark" size="compact-md" radius="xl" disabled={cart.size === 0} onClick={onClear}>
          إفراغ السلة
        </Button>
      </Group>
      <Box px="lg">
        <Divider style={{ borderStyle: 'dashed' }} />
      </Box>
      <ScrollArea style={{ flex: 1 }} px="md" py="sm">
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
            {lines.map(({ product, qty, totalMilli: lineTotal }, i) => (
              <Paper
                key={product.id}
                p="xs"
                radius="lg"
                style={{ background: '#f8f8fb', border: '1px solid #ececf1' }}
              >
                <Group justify="space-between" wrap="nowrap" mb={6} gap="xs">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Center
                      w={28}
                      h={28}
                      style={{ borderRadius: '50%', background: 'white', border: '1px solid #ececf1', flexShrink: 0 }}
                    >
                      <Text size="xs" fw={700} span>
                        {i + 1}
                      </Text>
                    </Center>
                    <div style={{ minWidth: 0 }}>
                      <Text fw={700} truncate>
                        {product.name}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {isCountUnit(product.unit) ? fmt(product.priceMilli) : `${fmt(product.priceMilli)} / ${UNIT_LABELS[product.unit]}`}
                      </Text>
                    </div>
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    color="red.8"
                    size="lg"
                    onClick={() => onSetQty(product.id, 0)}
                    aria-label="حذف"
                  >
                    <IconTrash size={20} />
                  </ActionIcon>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon size={44} variant="white" bd="1px solid #ececf1" onClick={() => onSetQty(product.id, qty - 1)} aria-label="إنقاص">
                      <IconMinus size={20} />
                    </ActionIcon>
                    <QtyField name={product.name} qty={qty} unit={product.unit} onCommit={(n) => onSetQty(product.id, n)} />
                    <ActionIcon size={44} variant="white" bd="1px solid #ececf1" onClick={() => onSetQty(product.id, qty + 1)} aria-label="زيادة">
                      <IconPlus size={20} />
                    </ActionIcon>
                  </Group>
                  <Text fw={700} fz="lg">
                    {fmt(lineTotal)}
                  </Text>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </ScrollArea>
      <Box px="lg">
        <Divider style={{ borderStyle: 'dashed' }} />
      </Box>
      <Stack p="lg" gap="sm">
        {voidable && (
          <Paper radius="lg" px="sm" py={6} style={{ background: '#f8f8fb', border: '1px solid #ececf1' }}>
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
                إلغاء الفاتورة
              </Button>
            </Group>
          </Paper>
        )}
        <Group justify="space-between" align="baseline">
          <Text fw={600} size="lg" c="dimmed">
            الإجمالي
          </Text>
          <Text fw={700} fz={34} lh={1.1}>
            {fmt(totalMilli)}
          </Text>
        </Group>
        <Stack gap={4}>
          <Button size="xl" radius="xl" color="dark" fullWidth disabled={!canCheckout} loading={checkingOut} onClick={onCheckout}>
            إتمام البيع (نقداً)
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            F9 أو Ctrl+Enter لإتمام البيع • F2 للبحث
          </Text>
        </Stack>
      </Stack>
    </Flex>
  );
}

/** Quantity shown as a number; clicking it switches to a typed input that commits on Enter or blur. */
function QtyField({ name, qty, unit, onCommit }: { name: string; qty: number; unit: Unit; onCommit: (qty: number) => void }) {
  const [draft, setDraft] = useState<number | string | null>(null);
  const countUnit = isCountUnit(unit);

  if (draft === null) {
    return (
      <UnstyledButton
        onClick={() => setDraft(qty)}
        aria-label={`كمية ${name}: ${formatUnitQty(qty, unit)}، اضغط للتعديل`}
        miw={44}
        mih={44}
        px={4}
        style={{ borderRadius: 'var(--mantine-radius-sm)', textAlign: 'center' }}
      >
        <Text fw={700} size="xl" span>
          {formatQty(qty)}
        </Text>
        {unit !== 'pcs' && (
          <Text size="xs" c="dimmed" span>
            {' '}
            {UNIT_LABELS[unit]}
          </Text>
        )}
      </UnstyledButton>
    );
  }

  const commit = () => {
    const n = Number(draft);
    // Count units take whole quantities from 1; weight/volume units any positive amount to 3 decimals.
    const next = countUnit ? n : Math.round(n * 1000) / 1000;
    const valid = countUnit ? Number.isInteger(n) && n >= 1 : Number.isFinite(next) && next > 0;
    if (valid && next !== qty) onCommit(next);
    setDraft(null);
  };

  return (
    <NumberInput
      autoFocus
      value={draft}
      onChange={setDraft}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(null);
        }
      }}
      min={countUnit ? 1 : undefined}
      allowDecimal={!countUnit}
      decimalScale={3}
      allowNegative={false}
      hideControls
      size="md"
      w={countUnit ? 64 : 84}
      aria-label={`كمية ${name} (${UNIT_LABELS[unit]})`}
      styles={{ input: { textAlign: 'center', fontWeight: 700 } }}
    />
  );
}

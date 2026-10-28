import { useState } from 'react';
import { Box, Flex } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { listProducts } from '../api';
import { Cart } from './Cart';
import { CloseShiftModal } from './CloseShiftModal';
import { OpenShiftModal } from './OpenShiftModal';
import { ProductGrid } from './ProductGrid';
import { ShiftBar } from './ShiftBar';

export function PosScreen({ onAdmin }: { onAdmin: () => void }) {
  const [cart, setCart] = useState<Map<number, number>>(() => new Map());
  const [openShiftOpened, setOpenShiftOpened] = useState(false);
  const [closeShiftOpened, setCloseShiftOpened] = useState(false);
  const { data: products = [] } = useQuery({ queryKey: ['list_products', false], queryFn: () => listProducts(false) });

  const setQty = (productId: number, qty: number) =>
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(productId);
      else next.set(productId, qty);
      return next;
    });

  return (
    <Flex direction="column" h="100vh" style={{ overflow: 'hidden' }}>
      <ShiftBar onOpenShift={() => setOpenShiftOpened(true)} onCloseShift={() => setCloseShiftOpened(true)} onAdmin={onAdmin} />
      <Flex style={{ flex: 1, minHeight: 0 }}>
        <Box style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <ProductGrid
            products={products}
            cart={cart}
            onAdd={(productId) => setQty(productId, (cart.get(productId) ?? 0) + 1)}
            onOpenShift={() => setOpenShiftOpened(true)}
          />
        </Box>
        <Box w={380} style={{ flexShrink: 0, borderInlineStart: '1px solid var(--mantine-color-gray-3)' }}>
          <Cart products={products} cart={cart} onSetQty={setQty} onClear={() => setCart(new Map())} />
        </Box>
      </Flex>
      <OpenShiftModal opened={openShiftOpened} onClose={() => setOpenShiftOpened(false)} />
      <CloseShiftModal opened={closeShiftOpened} onClose={() => setCloseShiftOpened(false)} />
    </Flex>
  );
}

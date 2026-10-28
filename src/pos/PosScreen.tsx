import { type Dispatch, type SetStateAction, useState } from 'react';
import { Box, Flex } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { createSale, listProducts } from '../api';
import { useMutate } from '../lib/useMutate';
import { useMoney } from '../lib/useSettings';
import type { Sale } from '../api/types';
import { Cart } from './Cart';
import { CloseShiftModal } from './CloseShiftModal';
import { OpenShiftModal } from './OpenShiftModal';
import { ProductGrid } from './ProductGrid';
import { ShiftBar } from './ShiftBar';

export type CartMap = Map<number, number>;

/** POS state that must outlive the POS screen (switching to admin unmounts it). */
export interface PosSession {
  cart: CartMap;
  setCart: Dispatch<SetStateAction<CartMap>>;
  /** The cart emptied by «إفراغ السلة», restorable until something is added. */
  clearedCart: CartMap | null;
  setClearedCart: Dispatch<SetStateAction<CartMap | null>>;
  lastSale: Sale | null;
  setLastSale: Dispatch<SetStateAction<Sale | null>>;
}

export function usePosSession(): PosSession {
  const [cart, setCart] = useState<CartMap>(() => new Map());
  const [clearedCart, setClearedCart] = useState<CartMap | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  return { cart, setCart, clearedCart, setClearedCart, lastSale, setLastSale };
}

export function PosScreen({ session, onAdmin }: { session: PosSession; onAdmin: () => void }) {
  const { cart, setCart, clearedCart, setClearedCart, lastSale, setLastSale } = session;
  const [openShiftOpened, setOpenShiftOpened] = useState(false);
  const [closeShiftOpened, setCloseShiftOpened] = useState(false);
  const { fmt } = useMoney();
  const sale = useMutate(createSale, (s) => `تمت عملية البيع رقم ${s.id} — ${fmt(s.totalMilli)}`, (s) => {
    setLastSale(s);
    setClearedCart(null);
    setCart(new Map());
  });
  const { data: products = [] } = useQuery({ queryKey: ['list_products', false], queryFn: () => listProducts(false) });

  const setQty = (productId: number, qty: number) => {
    setClearedCart(null);
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(productId);
      else next.set(productId, qty);
      return next;
    });
  };

  const byId = new Map(products.map((p) => [p.id, p]));
  const totalMilli = [...cart].reduce((sum, [id, qty]) => sum + (byId.get(id)?.priceMilli ?? 0) * qty, 0);

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
          <Cart
            products={products}
            cart={cart}
            totalMilli={totalMilli}
            onSetQty={setQty}
            onClear={() => {
              setClearedCart(cart);
              setCart(new Map());
            }}
            canRestore={!!clearedCart}
            onRestore={() => {
              if (clearedCart) setCart(clearedCart);
              setClearedCart(null);
            }}
            onCheckout={() => sale.mutate({ items: [...cart].map(([productId, qty]) => ({ productId, qty })) })}
            checkingOut={sale.isPending}
            lastSale={lastSale}
            onLastSaleVoided={() => setLastSale(null)}
          />
        </Box>
      </Flex>
      <OpenShiftModal opened={openShiftOpened} onClose={() => setOpenShiftOpened(false)} />
      <CloseShiftModal opened={closeShiftOpened} onClose={() => setCloseShiftOpened(false)} />
    </Flex>
  );
}

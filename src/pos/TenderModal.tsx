import { useEffect, useRef, useState } from 'react';
import { Button, Center, Group, Modal, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { createSale } from '../api';
import type { CartLine, Sale } from '../api/types';
import { MoneyInput } from '../components/MoneyInput';
import { fromMilli, toMilli } from '../lib/money';
import { useMutate } from '../lib/useMutate';
import { useMoney } from '../lib/useSettings';

/** Banknote values (major units) offered as one-tap "received" amounts. */
const NOTES = [5, 10, 20, 50, 100, 200, 500];

interface Props {
  opened: boolean;
  onClose: () => void;
  totalMilli: number;
  items: CartLine[];
  onSold: (sale: Sale) => void;
}

interface Done {
  sale: Sale;
  receivedMilli: number;
}

/** Cash tender: enter what the customer handed over, see the change, then confirm the sale. */
export function TenderModal({ opened, onClose, totalMilli, items, onSold }: Props) {
  const { fmt } = useMoney();
  const [received, setReceived] = useState<string | number>('');
  const [done, setDone] = useState<Done | null>(null);
  const receivedMilli = received === '' ? null : toMilli(Number(received) || 0);
  // The mutation callback outlives this render, so the paid amount travels through a ref.
  const paidRef = useRef(0);
  const sale = useMutate(createSale, null, (s) => {
    setDone({ sale: s, receivedMilli: paidRef.current });
    onSold(s);
  });

  useEffect(() => {
    if (opened) {
      setReceived('');
      setDone(null);
    }
  }, [opened]);

  const changeMilli = receivedMilli === null ? null : receivedMilli - totalMilli;
  const notes = NOTES.filter((n) => toMilli(n) > totalMilli).slice(0, 5);
  const confirm = (paidMilli: number) => {
    paidRef.current = paidMilli;
    setReceived(fromMilli(paidMilli));
    sale.mutate({ items });
  };

  return (
    <Modal opened={opened} onClose={onClose} title={done ? undefined : 'الدفع نقداً'} centered size="md" withCloseButton={!done}>
      {done ? (
        <Stack align="center" gap="md" py="md">
          <IconCircleCheck size={56} color="var(--mantine-color-green-7)" />
          <Text c="dimmed">تمت عملية البيع رقم {done.sale.id}</Text>
          <Text size="lg">الباقي للعميل</Text>
          <Text fw={800} fz={56} lh={1}>
            {fmt(done.receivedMilli - done.sale.totalMilli)}
          </Text>
          <Text size="sm" c="dimmed">
            المستلم {fmt(done.receivedMilli)} • الإجمالي {fmt(done.sale.totalMilli)}
          </Text>
          <Button size="xl" fullWidth data-autofocus onClick={onClose}>
            بيع جديد
          </Button>
        </Stack>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (receivedMilli !== null && changeMilli !== null && changeMilli >= 0) confirm(receivedMilli);
          }}
        >
          <Stack>
            <Group justify="space-between">
              <Text size="lg">الإجمالي</Text>
              <Text fw={700} fz={32}>
                {fmt(totalMilli)}
              </Text>
            </Group>
            <Button size="lg" variant="light" disabled={sale.isPending} onClick={() => confirm(totalMilli)}>
              المبلغ بالضبط
            </Button>
            {notes.length > 0 && (
              <SimpleGrid cols={notes.length}>
                {notes.map((n) => (
                  <Button key={n} size="lg" px={0} variant="default" disabled={sale.isPending} onClick={() => confirm(toMilli(n))}>
                    {n}
                  </Button>
                ))}
              </SimpleGrid>
            )}
            <MoneyInput label="المبلغ المستلم" size="lg" data-autofocus value={received} onChange={setReceived} />
            <Center>
              {changeMilli === null ? (
                <Text c="dimmed">أدخل المبلغ المستلم أو اختر فئة نقدية</Text>
              ) : changeMilli < 0 ? (
                <Text c="red.8" fw={700} size="lg">
                  المبلغ أقل من الإجمالي بـ {fmt(-changeMilli)}
                </Text>
              ) : (
                <Text fw={700} fz={28}>
                  الباقي {fmt(changeMilli)}
                </Text>
              )}
            </Center>
            <Button type="submit" size="xl" color="green" disabled={changeMilli === null || changeMilli < 0} loading={sale.isPending}>
              تأكيد البيع
            </Button>
          </Stack>
        </form>
      )}
    </Modal>
  );
}

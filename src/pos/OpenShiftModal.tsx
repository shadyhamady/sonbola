import { useState } from 'react';
import { Button, Group, Modal, Stack } from '@mantine/core';
import { openShift } from '../api';
import { MoneyInput } from '../components/MoneyInput';
import { toMilli } from '../lib/money';
import { useMutate } from '../lib/useMutate';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function OpenShiftModal({ opened, onClose }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="فتح وردية" centered>
      <OpenShiftForm onClose={onClose} />
    </Modal>
  );
}

function OpenShiftForm({ onClose }: { onClose: () => void }) {
  const [opening, setOpening] = useState<string | number>(0);
  const open = useMutate(openShift, 'تم فتح الوردية', onClose);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        open.mutate({ openingCashMilli: toMilli(Number(opening) || 0) });
      }}
    >
      <Stack>
        <MoneyInput label="النقد الافتتاحي في الدرج" size="lg" data-autofocus value={opening} onChange={setOpening} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" color="green" loading={open.isPending}>
            فتح الوردية
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

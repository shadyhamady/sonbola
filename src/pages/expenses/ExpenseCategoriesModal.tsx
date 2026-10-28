import { useState } from 'react';
import { ActionIcon, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import { createExpenseCategory, deleteExpenseCategory, renameExpenseCategory } from '../../api';
import type { Category } from '../../api/types';
import { useMutate } from '../../lib/useMutate';

interface Props {
  opened: boolean;
  categories: Category[];
  onClose: () => void;
}

export function ExpenseCategoriesModal({ opened, categories, onClose }: Props) {
  const [newName, setNewName] = useState('');
  const create = useMutate(createExpenseCategory, 'تمت إضافة الفئة', () => setNewName(''));

  const add = () => {
    const name = newName.trim();
    if (name) create.mutate({ name });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="إدارة الفئات">
      <Stack>
        {categories.map((c) => (
          <CategoryRow key={`${c.id}-${c.name}`} category={c} />
        ))}
        <Group align="flex-end" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            label="فئة جديدة"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={add} loading={create.isPending}>
            إضافة
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const [name, setName] = useState(category.name);
  const rename = useMutate(renameExpenseCategory, 'تم الحفظ');
  const remove = useMutate(deleteExpenseCategory, 'تم الحذف');
  const changed = name.trim() !== '' && name.trim() !== category.name;

  return (
    <Group wrap="nowrap">
      <TextInput
        style={{ flex: 1 }}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && changed) rename.mutate({ id: category.id, name: name.trim() });
        }}
      />
      <ActionIcon
        variant="subtle"
        color="green"
        disabled={!changed}
        loading={rename.isPending}
        onClick={() => rename.mutate({ id: category.id, name: name.trim() })}
        aria-label="حفظ"
      >
        <IconCheck size={16} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="red"
        onClick={() =>
          modals.openConfirmModal({
            title: 'حذف الفئة',
            children: <Text size="sm">هل تريد حذف الفئة «{category.name}»؟</Text>,
            labels: { confirm: 'حذف', cancel: 'إلغاء' },
            confirmProps: { color: 'red' },
            onConfirm: () => remove.mutate(category.id),
          })
        }
        aria-label="حذف"
      >
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  );
}

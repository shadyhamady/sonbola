import { useState } from 'react';
import { ActionIcon, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCheck, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createProductCategory, deleteProductCategory, listProductCategories, renameProductCategory } from '../../api';
import type { Category } from '../../api/types';
import { useMutate } from '../../lib/useMutate';

export function CategoriesModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const categories = useQuery({ queryKey: ['listProductCategories'], queryFn: listProductCategories });
  const [newName, setNewName] = useState('');
  const create = useMutate(createProductCategory, 'تمت إضافة الفئة', () => setNewName(''));

  return (
    <Modal opened={opened} onClose={onClose} title="إدارة الفئات">
      <Stack>
        {(categories.data ?? []).map((c) => (
          <CategoryRow key={`${c.id}-${c.name}`} category={c} />
        ))}
        {categories.data?.length === 0 && <Text c="dimmed">لا توجد فئات</Text>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) create.mutate({ name: newName.trim() });
          }}
        >
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <TextInput
              style={{ flex: 1 }}
              label="فئة جديدة"
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
            />
            <Button type="submit" loading={create.isPending} disabled={!newName.trim()}>
              إضافة
            </Button>
          </Group>
        </form>
      </Stack>
    </Modal>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const [name, setName] = useState(category.name);
  const rename = useMutate(renameProductCategory, 'تم تعديل الفئة');
  const remove = useMutate(deleteProductCategory, 'تم حذف الفئة');
  const changed = name.trim() !== '' && name.trim() !== category.name;

  return (
    <Group gap="xs" wrap="nowrap">
      <TextInput style={{ flex: 1 }} value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <ActionIcon
        size="lg"
        variant="light"
        color="green"
        aria-label="حفظ"
        disabled={!changed}
        loading={rename.isPending}
        onClick={() => rename.mutate({ id: category.id, name: name.trim() })}
      >
        <IconCheck size={18} />
      </ActionIcon>
      <ActionIcon
        size="lg"
        variant="light"
        color="red"
        aria-label="حذف"
        loading={remove.isPending}
        onClick={() =>
          modals.openConfirmModal({
            title: 'حذف الفئة',
            children: <Text size="sm">هل تريد حذف الفئة «{category.name}»؟</Text>,
            labels: { confirm: 'حذف', cancel: 'إلغاء' },
            confirmProps: { color: 'red' },
            onConfirm: () => remove.mutate(category.id),
          })
        }
      >
        <IconTrash size={18} />
      </ActionIcon>
    </Group>
  );
}

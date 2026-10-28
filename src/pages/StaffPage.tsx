import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Stack, Switch, Table, Text, Title, Tooltip } from '@mantine/core';
import { IconArchive, IconArchiveOff, IconChevronLeft, IconPencil, IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { listStaff, setStaffArchived } from '../api';
import { PAY_TYPE_LABELS } from '../api/labels';
import type { Staff } from '../api/types';
import { formatDate } from '../lib/dates';
import { useMutate } from '../lib/useMutate';
import { useMoney } from '../lib/useSettings';
import { StaffDrawer } from './staff/StaffDrawer';
import { StaffFormModal } from './staff/StaffFormModal';

export function StaffPage() {
  const { fmt } = useMoney();
  const [showArchived, setShowArchived] = useState(false);
  /** undefined = closed, null = new */
  const [editing, setEditing] = useState<Staff | null | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: staff = [] } = useQuery({
    queryKey: ['listStaff', showArchived],
    queryFn: () => listStaff(showArchived),
  });
  const archive = useMutate((s: Staff) => setStaffArchived(s.id, !s.archived), 'تم الحفظ');
  const selected = staff.find((s) => s.id === selectedId) ?? null;

  const totals = staff.reduce(
    (t, s) => ({
      paid: t.paid + s.paidMilli,
      earned: t.earned + s.earnedMilli,
      owed: t.owed + Math.max(s.owedMilli ?? 0, 0),
    }),
    { paid: 0, earned: 0, owed: 0 },
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>الموظفون والرواتب</Title>
        <Group>
          <Switch
            label="عرض المؤرشف"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.currentTarget.checked)}
          />
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing(null)}>
            إضافة موظف
          </Button>
        </Group>
      </Group>

      <Table.ScrollContainer minWidth={700}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>الاسم</Table.Th>
              <Table.Th>الوظيفة</Table.Th>
              <Table.Th>نوع الأجر</Table.Th>
              <Table.Th>الأجر</Table.Th>
              <Table.Th>الهاتف</Table.Th>
              <Table.Th>تاريخ البدء</Table.Th>
              <Table.Th>المدفوع (الكل)</Table.Th>
              <Table.Th>المكتسب</Table.Th>
              <Table.Th>المستحق</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {staff.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={10}>
                  <Text c="dimmed" ta="center">
                    لا يوجد موظفون
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {staff.map((s) => (
              <Table.Tr
                key={s.id}
                tabIndex={0}
                role="button"
                aria-label={`عرض تفاصيل ${s.name}`}
                className="mantine-focus-auto"
                style={{ cursor: 'pointer', opacity: s.archived ? 0.6 : 1, outlineOffset: -2 }}
                onClick={() => setSelectedId(s.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(s.id);
                  }
                }}
              >
                <Table.Td fw={600}>
                  {s.name}
                  {s.archived && (
                    <Badge ms="xs" size="xs" color="gray">
                      مؤرشف
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>{s.role ?? '—'}</Table.Td>
                <Table.Td>{PAY_TYPE_LABELS[s.payType]}</Table.Td>
                <Table.Td>{s.payType === 'production' ? '—' : fmt(s.rateMilli)}</Table.Td>
                <Table.Td>{s.phone ?? '—'}</Table.Td>
                <Table.Td>{s.startDate ? formatDate(s.startDate) : '—'}</Table.Td>
                <Table.Td>{fmt(s.paidMilli)}</Table.Td>
                <Table.Td>{s.payType === 'production' ? fmt(s.earnedMilli) : '—'}</Table.Td>
                <Table.Td>
                  <OwedCell owed={s.owedMilli} fmt={fmt} />
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label="تعديل">
                      <ActionIcon variant="subtle" onClick={() => setEditing(s)} aria-label="تعديل">
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={s.archived ? 'إلغاء الأرشفة' : 'أرشفة'}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => archive.mutate(s)}
                        aria-label={s.archived ? 'إلغاء الأرشفة' : 'أرشفة'}
                      >
                        {s.archived ? <IconArchiveOff size={16} /> : <IconArchive size={16} />}
                      </ActionIcon>
                    </Tooltip>
                    <Button
                      variant="subtle"
                      color="gray"
                      size="compact-sm"
                      tabIndex={-1}
                      rightSection={<IconChevronLeft size={16} />}
                      onClick={() => setSelectedId(s.id)}
                    >
                      عرض
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          {staff.length > 0 && (
            <Table.Tfoot>
              <Table.Tr fw={700}>
                <Table.Td colSpan={6}>الإجمالي</Table.Td>
                <Table.Td>{fmt(totals.paid)}</Table.Td>
                <Table.Td>{fmt(totals.earned)}</Table.Td>
                <Table.Td>{fmt(totals.owed)}</Table.Td>
                <Table.Td />
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Table.ScrollContainer>

      {editing !== undefined && <StaffFormModal staff={editing} onClose={() => setEditing(undefined)} />}
      <StaffDrawer staff={selected} onClose={() => setSelectedId(null)} />
    </Stack>
  );
}

function OwedCell({ owed, fmt }: { owed: number | null; fmt: (milli: number) => string }) {
  if (owed === null) return <>—</>;
  if (owed > 0)
    return (
      <Group gap={6} wrap="nowrap">
        <Text fw={600} c="green.8">
          {fmt(owed)}
        </Text>
        <Badge color="green" variant="light">
          مستحق
        </Badge>
      </Group>
    );
  if (owed < 0)
    return (
      <Group gap={6} wrap="nowrap">
        <Text fw={600} c="orange.9">
          {fmt(-owed)}
        </Text>
        <Badge color="orange" variant="light">
          سلفة
        </Badge>
      </Group>
    );
  return <>{fmt(0)}</>;
}

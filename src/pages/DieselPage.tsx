import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  NumberInput,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { IconAlertTriangle, IconInfoCircle, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { createDieselLog, dashboardSnapshot, deleteDieselLog, listDieselLogs, periodReport } from '../api';
import { RangePicker, useRange } from '../components/RangePicker';
import { formatDate, monthRange, toLocalDateString } from '../lib/dates';
import { formatPct, formatQty } from '../lib/money';
import { useMutate } from '../lib/useMutate';
import { useMoney, useSettings } from '../lib/useSettings';

/** '' (empty NumberInput) → null. */
const optionalNumber = (v: number | string) => (v === '' ? null : Number(v));

export function DieselPage() {
  const { fmt } = useMoney();
  const { data: settings } = useSettings();
  const [month] = useState(() => monthRange());
  const [range, setRange] = useRange();

  const { data: snapshot } = useQuery({ queryKey: ['dashboard_snapshot'], queryFn: dashboardSnapshot });
  const { data: monthReport } = useQuery({
    queryKey: ['period_report', month],
    queryFn: () => periodReport(month),
  });
  const { data: logs = [] } = useQuery({
    queryKey: ['list_diesel_logs', range],
    queryFn: () => listDieselLogs(range),
  });

  const form = useForm({
    initialValues: {
      date: toLocalDateString(new Date()) as string | null,
      tankReading: '' as number | string,
      manualLiters: '' as number | string,
      ovenHours: '' as number | string,
      note: '',
    },
    validate: { date: (v) => (v ? null : 'اختر التاريخ') },
  });
  const create = useMutate(createDieselLog, 'تم حفظ القراءة', () =>
    form.setValues({ tankReading: '', manualLiters: '', ovenHours: '', note: '' }),
  );
  const del = useMutate(deleteDieselLog, 'تم حذف القراءة');

  const submit = form.onSubmit((v) =>
    create.mutate({
      logDate: toLocalDateString(v.date!),
      tankReadingL: optionalNumber(v.tankReading),
      manualLiters: optionalNumber(v.manualLiters),
      ovenHours: optionalNumber(v.ovenHours),
      note: v.note.trim() || null,
    }),
  );

  const confirmDelete = (id: number) =>
    modals.openConfirmModal({
      title: 'حذف القراءة',
      children: <Text size="sm">سيتم حذف آخر قراءة وإعادة اللترات إلى مخزون الديزل. هل أنت متأكد؟</Text>,
      labels: { confirm: 'حذف', cancel: 'إلغاء' },
      confirmProps: { color: 'red' },
      onConfirm: () => del.mutate(id),
    });

  const tankLevel = snapshot?.tankLevel ?? 0;
  const daysLeft = snapshot?.daysOfDieselLeft ?? null;
  const levelColor = tankLevel < 0.2 ? 'red' : tankLevel < 0.4 ? 'orange' : 'green';
  const totals = logs.reduce(
    (t, l) => ({ liters: t.liters + l.litersUsed, cost: t.cost + l.costMilli, hours: t.hours + (l.ovenHours ?? 0) }),
    { liters: 0, cost: 0, hours: 0 },
  );

  return (
    <Stack>
      <Title order={2}>الديزل</Title>

      {settings && settings.dieselIngredientId === null && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />}>
          حدد مادة الديزل في الإعدادات
        </Alert>
      )}

      <SimpleGrid cols={{ base: 2, lg: 4 }}>
        <Card withBorder>
          <Text size="sm" c="dimmed">
            الديزل في الخزان
          </Text>
          <Text fw={700} size="xl" c={(snapshot?.dieselInTankL ?? 0) < 0 ? 'red' : undefined}>
            {formatQty(snapshot?.dieselInTankL ?? 0)} لتر
          </Text>
        </Card>
        <Card withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              مستوى الخزان
            </Text>
            <Text fw={700}>{formatPct(tankLevel)}</Text>
          </Group>
          <Progress
            mt="md"
            size="lg"
            value={Math.min(Math.max(tankLevel, 0), 1) * 100}
            color={levelColor}
          />
          <Text size="xs" c="dimmed" mt={4}>
            السعة: {formatQty(settings?.tankCapacityL ?? 0)} لتر
          </Text>
        </Card>
        <Card withBorder>
          <Text size="sm" c="dimmed">
            الأيام المتبقية
          </Text>
          <Text fw={700} size="xl">
            {daysLeft !== null ? `${formatQty(Math.round(daysLeft * 10) / 10)} يوم` : '—'}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="sm" c="dimmed">
            استهلاك هذا الشهر
          </Text>
          <Text fw={700} size="xl">
            {formatQty(monthReport?.dieselLitersUsed ?? 0)} لتر
          </Text>
          <Text size="sm">{fmt(monthReport?.dieselCostUsedMilli ?? 0)}</Text>
        </Card>
      </SimpleGrid>

      <Card withBorder>
        <form onSubmit={submit}>
          <Stack>
            <Title order={4}>تسجيل قراءة</Title>
            <SimpleGrid cols={{ base: 2, lg: 4 }}>
              <DatePickerInput label="التاريخ" valueFormat="YYYY/MM/DD" {...form.getInputProps('date')} />
              <NumberInput
                label="قراءة الخزان عند الإغلاق (لتر)"
                min={0}
                decimalScale={2}
                hideControls
                {...form.getInputProps('tankReading')}
              />
              <NumberInput
                label="لترات مستهلكة (يدوي، اختياري)"
                description="يُستخدم إذا لم تتوفر قراءة، أو لأول إدخال"
                min={0}
                decimalScale={2}
                hideControls
                {...form.getInputProps('manualLiters')}
              />
              <NumberInput
                label="ساعات تشغيل الفرن"
                min={0}
                decimalScale={2}
                hideControls
                {...form.getInputProps('ovenHours')}
              />
            </SimpleGrid>
            <TextInput label="ملاحظة" {...form.getInputProps('note')} />
            <Group justify="space-between">
              <Group gap={6}>
                <IconInfoCircle size={16} color="var(--mantine-color-dimmed)" />
                <Text size="sm" c="dimmed">
                  اشترِ الديزل من صفحة المشتريات ليُضاف إلى المخزون
                </Text>
              </Group>
              <Button type="submit" loading={create.isPending}>
                حفظ القراءة
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      <RangePicker value={range} onChange={setRange} />
      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>التاريخ</Table.Th>
              <Table.Th>قراءة الخزان (لتر)</Table.Th>
              <Table.Th>اللترات المستهلكة</Table.Th>
              <Table.Th>التكلفة</Table.Th>
              <Table.Th>ساعات التشغيل</Table.Th>
              <Table.Th>لتر/ساعة</Table.Th>
              <Table.Th>ملاحظة</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {logs.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" ta="center">
                    لا توجد قراءات في هذه الفترة
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {logs.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>{formatDate(l.logDate)}</Table.Td>
                <Table.Td>{l.tankReadingL != null ? formatQty(l.tankReadingL) : '—'}</Table.Td>
                <Table.Td fw={600}>
                  {formatQty(l.litersUsed)}
                  {l.manualLiters != null && (
                    <Text span size="xs" c="dimmed">
                      {' '}
                      (يدوي)
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{fmt(l.costMilli)}</Table.Td>
                <Table.Td>{l.ovenHours != null ? formatQty(l.ovenHours) : '—'}</Table.Td>
                <Table.Td>{l.litersPerHour != null ? formatQty(Math.round(l.litersPerHour * 100) / 100) : '—'}</Table.Td>
                <Table.Td>{l.note}</Table.Td>
                <Table.Td>
                  {l.isLatest && (
                    <Tooltip label="حذف">
                      <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete(l.id)}>
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th colSpan={2}>الإجمالي</Table.Th>
              <Table.Th>{formatQty(totals.liters)}</Table.Th>
              <Table.Th>{fmt(totals.cost)}</Table.Th>
              <Table.Th>{formatQty(totals.hours)}</Table.Th>
              <Table.Th colSpan={3} />
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

import { Alert, Badge, Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { PAY_BASIS_UNIT, UNIT_LABELS } from '../../api/labels';
import type { ProductionPreview } from '../../api/types';
import { formatQty } from '../../lib/money';
import { useMoney } from '../../lib/useSettings';

export function ProductionPreviewPanel({ preview }: { preview: ProductionPreview }) {
  const { fmt } = useMoney();
  const shareUnit = PAY_BASIS_UNIT[preview.payMode];

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        عدد الدفعات: {formatQty(preview.batches)}
      </Text>

      {preview.ingredients.length === 0 ? (
        <Alert color="orange" variant="light">
          هذا المنتج بدون وصفة، لن يتم خصم أي مكونات
        </Alert>
      ) : (
        <div>
          <Title order={4} size="h5" mb="xs">
            المكونات
          </Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>المكوّن</Table.Th>
                <Table.Th>الكمية المطلوبة</Table.Th>
                <Table.Th>المخزون الحالي</Table.Th>
                <Table.Th>التكلفة</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {preview.ingredients.map((i) => {
                const short = i.requiredQty > i.stockQty;
                return (
                  <Table.Tr
                    key={i.ingredientId}
                    c={short ? 'red.8' : undefined}
                    bg={short ? 'var(--mantine-color-red-light)' : undefined}
                  >
                    <Table.Td>{i.name}</Table.Td>
                    <Table.Td>
                      {formatQty(i.requiredQty)} {UNIT_LABELS[i.unit]}
                    </Table.Td>
                    <Table.Td>
                      {formatQty(i.stockQty)} {UNIT_LABELS[i.unit]}
                    </Table.Td>
                    <Table.Td>{fmt(i.costMilli)}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
      )}

      {preview.workers.length > 0 && (
        <div>
          <Group mb="xs" gap="xs">
            <Title order={4} size="h5">
              الخبازون
            </Title>
            {preview.usedDefaultBaker && (
              <Badge variant="light" color="blue">
                تم استخدام الخباز الافتراضي
              </Badge>
            )}
          </Group>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>الخباز</Table.Th>
                <Table.Th>الحصة</Table.Th>
                <Table.Th>الأجر</Table.Th>
                <Table.Th>المبلغ</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {preview.workers.map((w) => (
                <Table.Tr key={w.staffId}>
                  <Table.Td>{w.name}</Table.Td>
                  <Table.Td>{preview.payMode === 'none' ? '—' : `${formatQty(w.basisQty)} ${shareUnit}`}</Table.Td>
                  <Table.Td>{preview.payMode === 'none' ? '—' : fmt(w.rateMilli)}</Table.Td>
                  <Table.Td>{fmt(w.amountMilli)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}

      <Paper withBorder p="sm" bg="var(--mantine-color-gray-0)">
        <SimpleGrid cols={5}>
          <Total label="المكونات" value={fmt(preview.ingredientCostMilli)} />
          <Total label="أجر الخبازين" value={fmt(preview.laborCostMilli)} />
          <Total label="التشغيل" value={fmt(preview.overheadMilli)} />
          <Total label="الإجمالي" value={fmt(preview.totalCostMilli)} bold />
          <Total label="تكلفة القطعة" value={fmt(preview.unitCostMilli)} bold />
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}

function Total({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={bold ? 700 : 500}>{value}</Text>
    </div>
  );
}

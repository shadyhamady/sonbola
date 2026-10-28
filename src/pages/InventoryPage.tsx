import { Stack, Tabs, Title } from '@mantine/core';
import { AdjustmentsTab } from './inventory/AdjustmentsTab';
import { IngredientsTab } from './inventory/IngredientsTab';

export function InventoryPage() {
  return (
    <Stack>
      <Title order={2}>المخزون</Title>
      <Tabs defaultValue="ingredients">
        <Tabs.List>
          <Tabs.Tab value="ingredients">المكونات</Tabs.Tab>
          <Tabs.Tab value="adjustments">تعديلات المخزون</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="ingredients" pt="md">
          <IngredientsTab />
        </Tabs.Panel>
        <Tabs.Panel value="adjustments" pt="md">
          <AdjustmentsTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

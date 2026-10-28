import { Stack, Tabs, Title } from '@mantine/core';
import { DailySalesTab } from './sales/DailySalesTab';
import { PosSalesTab } from './sales/PosSalesTab';

export function SalesPage() {
  return (
    <Stack>
      <Title order={2}>المبيعات</Title>
      <Tabs defaultValue="pos">
        <Tabs.List>
          <Tabs.Tab value="pos">فواتير نقطة البيع</Tabs.Tab>
          <Tabs.Tab value="daily">مبيعات يومية يدوية</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="pos" pt="md">
          <PosSalesTab />
        </Tabs.Panel>
        <Tabs.Panel value="daily" pt="md">
          <DailySalesTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

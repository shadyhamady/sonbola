import { Stack, Tabs, Title } from '@mantine/core';
import { PurchasesTab } from './purchases/PurchasesTab';
import { SuppliersTab } from './purchases/SuppliersTab';

export function PurchasesPage() {
  return (
    <Stack>
      <Title order={2}>المشتريات والموردون</Title>
      <Tabs defaultValue="purchases">
        <Tabs.List>
          <Tabs.Tab value="purchases">المشتريات</Tabs.Tab>
          <Tabs.Tab value="suppliers">الموردون</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="purchases" pt="md">
          <PurchasesTab />
        </Tabs.Panel>
        <Tabs.Panel value="suppliers" pt="md">
          <SuppliersTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

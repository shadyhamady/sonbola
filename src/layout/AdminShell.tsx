import type { ReactNode } from 'react';
import { AppShell, Button, Group, NavLink, ScrollArea, Title } from '@mantine/core';
import {
  IconBuildingStore,
  IconCash,
  IconChartBar,
  IconClock,
  IconCreditCard,
  IconDroplet,
  IconLayoutDashboard,
  IconPackage,
  IconReceipt,
  IconSettings,
  IconShoppingCart,
  IconToolsKitchen2,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react';
import { useSettings } from '../lib/useSettings';

export type PageKey =
  | 'dashboard'
  | 'sales'
  | 'products'
  | 'production'
  | 'inventory'
  | 'purchases'
  | 'diesel'
  | 'staff'
  | 'expenses'
  | 'shifts'
  | 'reports'
  | 'settings';

const NAV: { key: PageKey; label: string; icon: typeof IconCash }[] = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: IconLayoutDashboard },
  { key: 'sales', label: 'المبيعات', icon: IconReceipt },
  { key: 'products', label: 'المنتجات والوصفات', icon: IconBuildingStore },
  { key: 'production', label: 'الإنتاج', icon: IconToolsKitchen2 },
  { key: 'inventory', label: 'المخزون', icon: IconPackage },
  { key: 'purchases', label: 'المشتريات والموردون', icon: IconTruckDelivery },
  { key: 'diesel', label: 'الديزل', icon: IconDroplet },
  { key: 'staff', label: 'الموظفون والرواتب', icon: IconUsers },
  { key: 'expenses', label: 'المصروفات', icon: IconCreditCard },
  { key: 'shifts', label: 'الورديات', icon: IconClock },
  { key: 'reports', label: 'التقارير', icon: IconChartBar },
  { key: 'settings', label: 'الإعدادات', icon: IconSettings },
];

interface Props {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  onPos: () => void;
  children: ReactNode;
}

export function AdminShell({ page, onNavigate, onPos, children }: Props) {
  const { data: settings } = useSettings();
  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 240, breakpoint: 0 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>{settings?.bakeryName}</Title>
          <Button leftSection={<IconShoppingCart size={18} />} onClick={onPos}>
            نقطة البيع
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        <ScrollArea>
          {NAV.map(({ key, label, icon: Icon }) => (
            <NavLink
              key={key}
              label={label}
              leftSection={<Icon size={18} />}
              active={page === key}
              onClick={() => onNavigate(key)}
              style={{ borderRadius: 'var(--mantine-radius-md)' }}
            />
          ))}
        </ScrollArea>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}

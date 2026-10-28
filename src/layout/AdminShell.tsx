import type { ReactNode } from 'react';
import { AppShell, Badge, Button, Group, NavLink, ScrollArea, Text, Title } from '@mantine/core';
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
import { useOpenShift } from '../components/PaymentFields';
import { formatTime } from '../lib/dates';
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

type NavItem = { key: PageKey; label: string; icon: typeof IconCash };

const NAV: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ key: 'dashboard', label: 'لوحة التحكم', icon: IconLayoutDashboard }] },
  {
    title: 'البيع',
    items: [
      { key: 'sales', label: 'المبيعات', icon: IconReceipt },
      { key: 'shifts', label: 'الورديات', icon: IconClock },
    ],
  },
  {
    title: 'الإنتاج والمخزون',
    items: [
      { key: 'products', label: 'المنتجات والوصفات', icon: IconBuildingStore },
      { key: 'production', label: 'الإنتاج', icon: IconToolsKitchen2 },
      { key: 'inventory', label: 'المخزون', icon: IconPackage },
      { key: 'diesel', label: 'الديزل', icon: IconDroplet },
    ],
  },
  {
    title: 'المال',
    items: [
      { key: 'purchases', label: 'المشتريات والموردون', icon: IconTruckDelivery },
      { key: 'expenses', label: 'المصروفات', icon: IconCreditCard },
      { key: 'staff', label: 'الموظفون والرواتب', icon: IconUsers },
      { key: 'reports', label: 'التقارير', icon: IconChartBar },
    ],
  },
  { title: 'الإعداد', items: [{ key: 'settings', label: 'الإعدادات', icon: IconSettings }] },
];

interface Props {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  onPos: () => void;
  children: ReactNode;
}

export function AdminShell({ page, onNavigate, onPos, children }: Props) {
  const { data: settings } = useSettings();
  const { data: openShift } = useOpenShift();
  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 240, breakpoint: 0 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm" wrap="nowrap">
            {/* h1: the app name; page titles are h2 and in-page sections h3. */}
            <Title order={1} size="h3">
              {settings?.bakeryName}
            </Title>
            {openShift ? (
              <Badge color="green" variant="light">
                {`وردية مفتوحة منذ ${formatTime(openShift.openedAt)}`}
              </Badge>
            ) : (
              <Badge color="gray" variant="light">
                لا توجد وردية مفتوحة
              </Badge>
            )}
          </Group>
          <Button leftSection={<IconShoppingCart size={18} />} onClick={onPos}>
            نقطة البيع
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        <ScrollArea>
          {NAV.map(({ title, items }) => (
            <div key={title ?? 'home'}>
              {title && (
                <Text size="xs" fw={700} c="dimmed" px="sm" pt="md" pb={4}>
                  {title}
                </Text>
              )}
              {items.map(({ key, label, icon: Icon }) => (
                <NavLink
                  key={key}
                  label={label}
                  leftSection={<Icon size={18} />}
                  active={page === key}
                  onClick={() => onNavigate(key)}
                  style={{ borderRadius: 'var(--mantine-radius-md)' }}
                />
              ))}
            </div>
          ))}
        </ScrollArea>
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}

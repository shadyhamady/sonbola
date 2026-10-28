import { useState } from 'react';
import { Center, Loader } from '@mantine/core';
import { AdminShell, type PageKey } from './layout/AdminShell';
import { useSettings } from './lib/useSettings';
import { DashboardPage } from './pages/DashboardPage';
import { DieselPage } from './pages/DieselPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductionPage } from './pages/ProductionPage';
import { ProductsPage } from './pages/ProductsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SalesPage } from './pages/SalesPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupPage } from './pages/SetupPage';
import { ShiftsPage } from './pages/ShiftsPage';
import { StaffPage } from './pages/StaffPage';
import { PosScreen } from './pos/PosScreen';

const PAGES: Record<PageKey, () => React.JSX.Element> = {
  dashboard: DashboardPage,
  sales: SalesPage,
  products: ProductsPage,
  production: ProductionPage,
  inventory: InventoryPage,
  purchases: PurchasesPage,
  diesel: DieselPage,
  staff: StaffPage,
  expenses: ExpensesPage,
  shifts: ShiftsPage,
  reports: ReportsPage,
  settings: SettingsPage,
};

export default function App() {
  const { data: settings, isLoading, error } = useSettings();
  const [mode, setMode] = useState<'pos' | 'admin'>('pos');
  const [page, setPage] = useState<PageKey>('dashboard');

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (error || !settings) {
    return <Center h="100vh">{String(error)}</Center>;
  }
  if (!settings.isConfigured) return <SetupPage />;
  if (mode === 'pos') return <PosScreen onAdmin={() => setMode('admin')} />;

  const Page = PAGES[page];
  return (
    <AdminShell page={page} onNavigate={setPage} onPos={() => setMode('pos')}>
      <Page />
    </AdminShell>
  );
}

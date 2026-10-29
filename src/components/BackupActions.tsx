import { Button, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDatabaseExport, IconDatabaseImport } from '@tabler/icons-react';
import { open, save } from '@tauri-apps/plugin-dialog';
import dayjs from 'dayjs';
import { exportBackup, importBackup } from '../api';
import { notifyError, useMutate } from '../lib/useMutate';

const FILTERS = [{ name: 'نسخة احتياطية لسنبلة', extensions: ['sonbola', 'db'] }];

/** Pick a destination and write a full backup of all data to it. */
export function ExportBackupButton() {
  const exp = useMutate(exportBackup, 'تم حفظ النسخة الاحتياطية');
  const choose = async () => {
    try {
      const path = await save({
        title: 'حفظ نسخة احتياطية',
        defaultPath: `sonbola-${dayjs().format('YYYY-MM-DD')}.sonbola`,
        filters: FILTERS,
      });
      if (path) exp.mutate(path);
    } catch (e) {
      notifyError(e);
    }
  };
  return (
    <Button variant="default" leftSection={<IconDatabaseExport size={18} />} loading={exp.isPending} onClick={choose}>
      تصدير نسخة احتياطية
    </Button>
  );
}

/**
 * Pick a backup file and replace all data with it. `confirm` asks first (use it whenever there is
 * existing data); the page reloads afterwards so no screen keeps stale ids.
 */
export function ImportBackupButton({ confirm = true, variant = 'default' }: { confirm?: boolean; variant?: 'default' | 'subtle' }) {
  const imp = useMutate(importBackup, 'تم استيراد البيانات', () => window.location.reload());
  const choose = async () => {
    try {
      const path = await open({ title: 'اختيار نسخة احتياطية', multiple: false, directory: false, filters: FILTERS });
      if (typeof path !== 'string') return;
      if (!confirm) return imp.mutate(path);
      modals.openConfirmModal({
        title: 'استيراد نسخة احتياطية',
        children: (
          <Text size="sm">
            سيتم استبدال كل البيانات الحالية ببيانات النسخة المختارة. تُحفظ نسخة من بياناتك الحالية تلقائياً قبل
            الاستيراد.
          </Text>
        ),
        labels: { confirm: 'استيراد', cancel: 'إلغاء' },
        confirmProps: { color: 'red' },
        onConfirm: () => imp.mutate(path),
      });
    } catch (e) {
      notifyError(e);
    }
  };
  return (
    <Button variant={variant} leftSection={<IconDatabaseImport size={18} />} loading={imp.isPending} onClick={choose}>
      استيراد نسخة احتياطية
    </Button>
  );
}

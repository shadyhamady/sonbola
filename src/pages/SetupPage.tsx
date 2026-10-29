import { Button, Card, Center, Divider, SegmentedControl, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { loadDemoData, saveSettings } from '../api';
import type { SettingsInput } from '../api/types';
import { ImportBackupButton } from '../components/BackupActions';
import { useMutate } from '../lib/useMutate';
import { useSettings } from '../lib/useSettings';

interface SetupVars {
  settings: SettingsInput;
  demo: boolean;
}

/** First-run dialogue: bakery identity and currency, optional demo data, or restore a backup. */
export function SetupPage() {
  const { data: settings } = useSettings();
  const form = useForm({
    initialValues: { bakeryName: 'سنبلة', currencySymbol: 'ل.س', currencyDecimals: '0', demo: false },
    validate: {
      bakeryName: (v) => (v.trim() ? null : 'أدخل اسم المخبز'),
      currencySymbol: (v) => (v.trim() ? null : 'أدخل رمز العملة'),
    },
  });
  const save = useMutate<SetupVars, void>(
    async ({ settings, demo }) => {
      await saveSettings(settings);
      if (demo) await loadDemoData();
    },
    'مرحباً بك في سنبلة',
  );

  return (
    <Center h="100vh">
      <Card withBorder radius="lg" p="xl" w={460}>
        <form
          onSubmit={form.onSubmit((v) =>
            save.mutate({
              demo: v.demo,
              settings: {
                bakeryName: v.bakeryName.trim(),
                currencySymbol: v.currencySymbol.trim(),
                currencyDecimals: Number(v.currencyDecimals),
                // Keep the seeded diesel / tank / default-baker settings.
                dieselIngredientId: settings?.dieselIngredientId ?? null,
                tankCapacityL: settings?.tankCapacityL ?? 1000,
                defaultBakerId: settings?.defaultBakerId ?? null,
              },
            }),
          )}
        >
          <Stack>
            <Title order={1} size="h2" ta="center">
              مرحباً بك في سنبلة
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              أدخل بيانات المخبز للبدء، ويمكنك تغييرها لاحقاً من الإعدادات
            </Text>
            <TextInput label="اسم المخبز" data-autofocus {...form.getInputProps('bakeryName')} />
            <TextInput label="رمز العملة" {...form.getInputProps('currencySymbol')} />
            <div>
              <Text size="sm" fw={500} mb={4}>
                عدد الخانات العشرية
              </Text>
              <SegmentedControl fullWidth data={['0', '2', '3']} {...form.getInputProps('currencyDecimals')} />
            </div>
            <Switch
              label="إضافة بيانات تجريبية"
              description="أسبوع من المشتريات والإنتاج والمبيعات لتجربة التطبيق. يمكن مسحها لاحقاً من الإعدادات"
              {...form.getInputProps('demo', { type: 'checkbox' })}
            />
            <Button type="submit" size="md" loading={save.isPending}>
              حفظ والبدء
            </Button>
            <Divider label="أو" labelPosition="center" />
            <ImportBackupButton confirm={false} />
          </Stack>
        </form>
      </Card>
    </Center>
  );
}

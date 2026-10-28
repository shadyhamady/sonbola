import { Button, Card, Center, SegmentedControl, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { saveSettings } from '../api';
import { useMutate } from '../lib/useMutate';
import { useSettings } from '../lib/useSettings';

export function SetupPage() {
  const { data: settings } = useSettings();
  const form = useForm({
    initialValues: { bakeryName: 'سنبلة', currencySymbol: 'ر.س', currencyDecimals: '2' },
    validate: {
      bakeryName: (v) => (v.trim() ? null : 'أدخل اسم المخبز'),
      currencySymbol: (v) => (v.trim() ? null : 'أدخل رمز العملة'),
    },
  });
  const save = useMutate(saveSettings, 'مرحباً بك في سنبلة');

  return (
    <Center h="100vh" bg="var(--mantine-color-gray-0)">
      <Card withBorder shadow="sm" radius="lg" p="xl" w={420}>
        <form
          onSubmit={form.onSubmit((v) =>
            save.mutate({
              bakeryName: v.bakeryName,
              currencySymbol: v.currencySymbol,
              currencyDecimals: Number(v.currencyDecimals),
              // Keep the seeded diesel / tank / default-baker settings.
              dieselIngredientId: settings?.dieselIngredientId ?? null,
              tankCapacityL: settings?.tankCapacityL ?? 1000,
              defaultBakerId: settings?.defaultBakerId ?? null,
            }),
          )}
        >
          <Stack>
            <Title order={1} size="h2" ta="center">
              إعداد المخبز
            </Title>
            <TextInput label="اسم المخبز" {...form.getInputProps('bakeryName')} />
            <TextInput label="رمز العملة" {...form.getInputProps('currencySymbol')} />
            <div>
              <Text size="sm" fw={500} mb={4}>
                عدد الخانات العشرية
              </Text>
              <SegmentedControl
                fullWidth
                data={['0', '2', '3']}
                {...form.getInputProps('currencyDecimals')}
              />
            </div>
            <Button type="submit" size="md" loading={save.isPending}>
              حفظ والبدء
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}

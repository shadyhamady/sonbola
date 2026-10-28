import {
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { listIngredients, listStaff, saveSettings } from '../api';
import type { Settings } from '../api/types';
import { useMutate } from '../lib/useMutate';
import { useSettings } from '../lib/useSettings';

export function SettingsPage() {
  const { data: settings } = useSettings();
  return (
    <Stack maw={560}>
      <Title order={2}>الإعدادات</Title>
      {settings ? <SettingsForm settings={settings} /> : <Loader />}
    </Stack>
  );
}

function SettingsForm({ settings }: { settings: Settings }) {
  const { data: ingredients = [] } = useQuery({
    queryKey: ['listIngredients', false],
    queryFn: () => listIngredients(false),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['listStaff', false],
    queryFn: () => listStaff(false),
  });
  const form = useForm({
    initialValues: {
      bakeryName: settings.bakeryName,
      currencySymbol: settings.currencySymbol,
      currencyDecimals: String(settings.currencyDecimals),
      dieselIngredientId: settings.dieselIngredientId === null ? null : String(settings.dieselIngredientId),
      tankCapacityL: settings.tankCapacityL as number | string,
      defaultBakerId: settings.defaultBakerId === null ? null : String(settings.defaultBakerId),
    } as {
      bakeryName: string;
      currencySymbol: string;
      currencyDecimals: string;
      dieselIngredientId: string | null;
      tankCapacityL: number | string;
      defaultBakerId: string | null;
    },
    validate: {
      bakeryName: (v) => (v.trim() ? null : 'أدخل اسم المخبز'),
      currencySymbol: (v) => (v.trim() ? null : 'أدخل رمز العملة'),
      tankCapacityL: (v) => (Number(v) > 0 ? null : 'أدخل سعة صحيحة'),
    },
  });
  const save = useMutate(saveSettings, 'تم حفظ الإعدادات');

  const dieselOptions = ingredients
    .filter((i) => i.unit === 'l')
    .map((i) => ({ value: String(i.id), label: i.name }));
  const bakerOptions = staff
    .filter((s) => s.payType === 'production')
    .map((s) => ({ value: String(s.id), label: s.name }));

  return (
    <form
      onSubmit={form.onSubmit((v) =>
        save.mutate({
          bakeryName: v.bakeryName.trim(),
          currencySymbol: v.currencySymbol.trim(),
          currencyDecimals: Number(v.currencyDecimals),
          dieselIngredientId: v.dieselIngredientId ? Number(v.dieselIngredientId) : null,
          tankCapacityL: Number(v.tankCapacityL),
          defaultBakerId: v.defaultBakerId ? Number(v.defaultBakerId) : null,
        }),
      )}
    >
      <Stack>
        <Card withBorder>
          <Stack>
            <Text fw={700}>المخبز والعملة</Text>
            <TextInput label="اسم المخبز" {...form.getInputProps('bakeryName')} />
            <TextInput label="رمز العملة" {...form.getInputProps('currencySymbol')} />
            <div>
              <Text size="sm" fw={500} mb={4}>
                عدد الخانات العشرية
              </Text>
              <SegmentedControl fullWidth data={['0', '2', '3']} {...form.getInputProps('currencyDecimals')} />
              <Text size="xs" c="dimmed" mt={4}>
                تغيير الخانات العشرية يؤثر على العرض فقط
              </Text>
            </div>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack>
            <Text fw={700}>الديزل</Text>
            <Select
              label="مادة الديزل"
              description="المكوّن الذي يُشترى ويُستهلك كديزل للفرن (يقاس باللتر)"
              placeholder="غير محدد"
              clearable
              data={dieselOptions}
              {...form.getInputProps('dieselIngredientId')}
            />
            <NumberInput
              label="سعة الخزان (لتر)"
              min={0}
              decimalScale={2}
              hideControls
              {...form.getInputProps('tankCapacityL')}
            />
          </Stack>
        </Card>
        <Card withBorder>
          <Stack>
            <Text fw={700}>الإنتاج</Text>
            <Select
              label="الخباز الافتراضي"
              description="يُستخدم عند تسجيل إنتاج بدون اختيار خباز"
              placeholder="بدون"
              clearable
              data={bakerOptions}
              {...form.getInputProps('defaultBakerId')}
            />
          </Stack>
        </Card>
        <Group justify="flex-end">
          <Button type="submit" leftSection={<IconDeviceFloppy size={18} />} loading={save.isPending}>
            حفظ
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

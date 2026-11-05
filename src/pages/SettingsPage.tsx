import {
  Button,
  Card,
  Group,
  Loader,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { IconDeviceFloppy, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { clearDemoData, listIngredients, listStaff, saveSettings } from '../api';
import type { Settings } from '../api/types';
import { ExportBackupButton, ImportBackupButton } from '../components/BackupActions';
import { RecoveryCodeBox, RemovePinModal, SetPinModal } from '../components/PinDialogs';
import { useMutate } from '../lib/useMutate';
import { useSettings } from '../lib/useSettings';

export function SettingsPage() {
  const { data: settings } = useSettings();
  return (
    <Stack maw={560}>
      <Title order={2}>الإعدادات</Title>
      {settings ? <SettingsForm settings={settings} /> : <Loader />}
      {settings && <PinCard enabled={settings.pinEnabled} />}
      {settings && <DataCard isDemo={settings.isDemo} />}
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

function DataCard({ isDemo }: { isDemo: boolean }) {
  const clear = useMutate(clearDemoData, 'تم مسح البيانات التجريبية');
  const confirmClear = () =>
    modals.openConfirmModal({
      title: 'مسح البيانات التجريبية',
      children: (
        <Text size="sm">
          سيتم حذف كل المشتريات والإنتاج والمبيعات والمصروفات والموردين والمنتجات والمكونات، بما في ذلك أي شيء
          أضفته بعد البيانات التجريبية، وتعود القوائم الأولية فارغة. يبقى اسم المخبز والعملة. لا يمكن التراجع، ويُنصح
          بتصدير نسخة احتياطية أولاً.
        </Text>
      ),
      labels: { confirm: 'مسح كل البيانات', cancel: 'إلغاء' },
      confirmProps: { color: 'red' },
      onConfirm: () => clear.mutate(),
    });
  return (
    <Card withBorder>
      <Stack>
        <Text fw={700}>النسخ الاحتياطي والبيانات</Text>
        <Text size="sm" c="dimmed">
          التصدير يحفظ كل بياناتك في ملف واحد يمكن نقله إلى جهاز آخر، والاستيراد يستبدل بيانات هذا الجهاز بمحتوى الملف.
        </Text>
        <Group>
          <ExportBackupButton />
          <ImportBackupButton />
        </Group>
        {isDemo && (
          <>
            <Text size="sm" c="dimmed">
              التطبيق يحتوي حالياً على بيانات تجريبية.
            </Text>
            <div>
              <Button
                color="red"
                variant="light"
                leftSection={<IconTrash size={18} />}
                loading={clear.isPending}
                onClick={confirmClear}
              >
                مسح البيانات التجريبية
              </Button>
            </div>
          </>
        )}
      </Stack>
    </Card>
  );
}

function PinCard({ enabled }: { enabled: boolean }) {
  const [setting, setSetting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  return (
    <Card withBorder>
      <Stack>
        <Text fw={700}>رمز دخول الإدارة</Text>
        <Text size="sm" c="dimmed">
          {enabled
            ? 'شاشة الإدارة محمية برمز. يُطلب الرمز في كل مرة تنتقل فيها من نقطة البيع إلى الإدارة.'
            : 'احمِ شاشة الإدارة (التقارير والأسعار والتكاليف) برمز من 4 إلى 8 أرقام. نقطة البيع تبقى مفتوحة للكاشير.'}
        </Text>
        <Text size="xs" c="dimmed">
          عند التفعيل تحصل على رمز استرداد يُعرض مرة واحدة، احتفظ به خارج الجهاز: هو الطريقة الوحيدة لإعادة تعيين الرمز إذا
          نسيته، لأن التطبيق يعمل بدون إنترنت. الرمز يمنع فتح الشاشة فقط ولا يشفّر ملف البيانات.
        </Text>
        <Group>
          <Button variant={enabled ? 'default' : 'filled'} onClick={() => setSetting(true)}>
            {enabled ? 'تغيير الرمز' : 'تفعيل الرمز'}
          </Button>
          {enabled && (
            <Button variant="light" color="red" onClick={() => setRemoving(true)}>
              إلغاء الرمز
            </Button>
          )}
        </Group>
      </Stack>
      <SetPinModal opened={setting} hasPin={enabled} onClose={() => setSetting(false)} onCode={setCode} />
      <RemovePinModal opened={removing} onClose={() => setRemoving(false)} />
      <Modal
        opened={code !== null}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        title="رمز الاسترداد"
        centered
        size="sm"
      >
        {code && <RecoveryCodeBox code={code} onDone={() => setCode(null)} />}
      </Modal>
    </Card>
  );
}

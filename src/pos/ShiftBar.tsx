import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Paper, Title, Tooltip } from '@mantine/core';
import { IconLayoutDashboard, IconMaximize, IconMinimize } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { shiftSummary } from '../api';
import { useOpenShift } from '../components/PaymentFields';
import { formatTime } from '../lib/dates';
import { notifyError } from '../lib/useMutate';
import { useMoney, useSettings } from '../lib/useSettings';

interface Props {
  onOpenShift: () => void;
  onCloseShift: () => void;
  onAdmin: () => void;
}

export function ShiftBar({ onOpenShift, onCloseShift, onAdmin }: Props) {
  const { data: settings } = useSettings();
  const { data: openShift } = useOpenShift();
  const { fmt } = useMoney();
  const { data: summary } = useQuery({
    queryKey: ['shift_summary', openShift?.id],
    queryFn: () => shiftSummary(openShift!.id),
    enabled: !!openShift,
  });
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    try {
      const win = getCurrentWindow();
      const next = !(await win.isFullscreen());
      await win.setFullscreen(next);
      setFullscreen(next);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Paper px="lg" py="sm" radius={0} withBorder style={{ borderInline: 0, borderTop: 0, borderColor: '#ececf1', background: 'white' }}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="md" wrap="nowrap">
          <Title order={1} size="h3">
            {settings?.bakeryName}
          </Title>
          {openShift ? (
            <Badge size="xl" radius="xl" color="mint.3" c="dark" variant="filled" h={36} fz={14} tt="none">
              {`الوردية مفتوحة منذ ${formatTime(openShift.openedAt)} • المبيعات: ${fmt(summary?.salesTotalMilli ?? 0)}`}
            </Badge>
          ) : (
            <Badge size="xl" radius="xl" color="gray.2" c="dark" variant="filled" h={36} fz={14} tt="none">
              لا توجد وردية مفتوحة
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          {openShift ? (
            <Button color="red" variant="light" radius="xl" size="md" h={44} onClick={onCloseShift}>
              إغلاق الوردية
            </Button>
          ) : (
            <Button color="dark" radius="xl" size="md" h={44} onClick={onOpenShift}>
              فتح وردية
            </Button>
          )}
          <Tooltip label={fullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}>
            <ActionIcon variant="default" radius="xl" size={44} onClick={toggleFullscreen} aria-label="ملء الشاشة">
              {fullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
            </ActionIcon>
          </Tooltip>
          <Button variant="default" radius="xl" size="md" h={44} leftSection={<IconLayoutDashboard size={18} />} onClick={onAdmin}>
            الإدارة
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

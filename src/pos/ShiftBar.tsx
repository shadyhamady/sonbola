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
    <Paper px="md" py="sm" radius={0} withBorder style={{ borderInline: 0, borderTop: 0 }}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="md" wrap="nowrap">
          <Title order={3}>{settings?.bakeryName}</Title>
          {openShift ? (
            <Badge size="lg" color="green" variant="light">
              {`الوردية مفتوحة منذ ${formatTime(openShift.openedAt)} • المبيعات: ${fmt(summary?.salesTotalMilli ?? 0)}`}
            </Badge>
          ) : (
            <Badge size="lg" color="gray" variant="light">
              لا توجد وردية مفتوحة
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          {openShift ? (
            <Button color="red" variant="light" onClick={onCloseShift}>
              إغلاق الوردية
            </Button>
          ) : (
            <Button color="green" onClick={onOpenShift}>
              فتح وردية
            </Button>
          )}
          <Tooltip label={fullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}>
            <ActionIcon variant="default" size="lg" onClick={toggleFullscreen} aria-label="ملء الشاشة">
              {fullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
            </ActionIcon>
          </Tooltip>
          <Button variant="default" leftSection={<IconLayoutDashboard size={18} />} onClick={onAdmin}>
            الإدارة
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

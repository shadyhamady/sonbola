import { useState } from 'react';
import { Alert, Button, Checkbox, CopyButton, Group, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { removePin, resetPin, setPin, verifyPin } from '../api';

/** Keeps digits only, accepting Arabic-Indic digits typed from an Arabic keyboard. */
const cleanPin = (v: string) =>
  v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, '').slice(0, 8);

const PIN_PROPS = { inputMode: 'numeric', maxLength: 8, autoComplete: 'off' } as const;

/** Shows the one-time recovery code; can only be dismissed after the owner confirms saving it. */
export function RecoveryCodeBox({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <Stack>
      <Text size="sm">
        احتفظ بهذا الرمز في مكان آمن خارج الجهاز (ورقة أو هاتفك). إذا نسيت رمز الدخول فهو الطريقة الوحيدة لإعادة
        تعيينه، ولن يظهر مرة أخرى.
      </Text>
      <Text ta="center" fw={700} size="xl" ff="monospace" style={{ letterSpacing: 2, direction: 'ltr' }}>
        {code}
      </Text>
      <CopyButton value={code}>
        {({ copied, copy }) => (
          <Button variant="default" leftSection={copied ? <IconCheck size={18} /> : <IconCopy size={18} />} onClick={copy}>
            {copied ? 'تم النسخ' : 'نسخ الرمز'}
          </Button>
        )}
      </CopyButton>
      <Checkbox label="حفظت رمز الاسترداد" checked={saved} onChange={(e) => setSaved(e.currentTarget.checked)} />
      <Button disabled={!saved} onClick={onDone}>
        متابعة
      </Button>
    </Stack>
  );
}

/** Asks for the PIN before entering the management area; offers recovery-code reset. */
export function UnlockModal({
  opened,
  onClose,
  onUnlocked,
}: {
  opened: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const qc = useQueryClient();
  const [view, setView] = useState<'pin' | 'forgot'>('pin');
  const [pin, setPinValue] = useState('');
  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setView('pin');
    setPinValue('');
    setCode('');
    setNewPin('');
    setIssued(null);
    setError(null);
    onClose();
  };

  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      if (await verifyPin(pin)) {
        close();
        onUnlocked();
      } else {
        setError('رمز الدخول غير صحيح');
        setPinValue('');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      setIssued(await resetPin({ recoveryCode: code, newPin }));
      await qc.invalidateQueries();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={issued ? () => {} : close}
      withCloseButton={!issued}
      closeOnClickOutside={!issued}
      closeOnEscape={!issued}
      title={issued ? 'رمز الاسترداد الجديد' : view === 'pin' ? 'رمز دخول الإدارة' : 'نسيت رمز الدخول'}
      centered
      size="sm"
    >
      {issued ? (
        <RecoveryCodeBox
          code={issued}
          onDone={() => {
            close();
            onUnlocked();
          }}
        />
      ) : view === 'pin' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length >= 4) void unlock();
          }}
        >
          <Stack>
            <PasswordInput
              label="أدخل رمز الدخول"
              data-autofocus
              value={pin}
              onChange={(e) => setPinValue(cleanPin(e.currentTarget.value))}
              error={error}
              {...PIN_PROPS}
            />
            <Button type="submit" loading={busy} disabled={pin.length < 4}>
              فتح
            </Button>
            <Button variant="subtle" onClick={() => { setView('forgot'); setError(null); }}>
              نسيت الرمز؟
            </Button>
          </Stack>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void reset();
          }}
        >
          <Stack>
            <Text size="sm" c="dimmed">
              أدخل رمز الاسترداد الذي حصلت عليه عند تفعيل الرمز، ثم اختر رمز دخول جديداً.
            </Text>
            <TextInput
              label="رمز الاسترداد"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              data-autofocus
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              styles={{ input: { direction: 'ltr', textAlign: 'left' } }}
            />
            <PasswordInput
              label="رمز الدخول الجديد (4 إلى 8 أرقام)"
              value={newPin}
              onChange={(e) => setNewPin(cleanPin(e.currentTarget.value))}
              {...PIN_PROPS}
            />
            {error && <Text c="red.8" size="sm">{error}</Text>}
            <Button type="submit" loading={busy} disabled={code.trim().length < 16 || newPin.length < 4}>
              إعادة تعيين الرمز
            </Button>
            <Button variant="subtle" onClick={() => { setView('pin'); setError(null); }}>
              رجوع
            </Button>
          </Stack>
        </form>
      )}
    </Modal>
  );
}

/** Set a PIN, or change it (needs the current one). Returns the new recovery code via `onCode`. */
export function SetPinModal({
  opened,
  hasPin,
  onClose,
  onCode,
}: {
  opened: boolean;
  hasPin: boolean;
  onClose: () => void;
  onCode: (code: string) => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const close = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    onClose();
  };
  const mismatch = confirm.length > 0 && confirm !== next;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await setPin({ newPin: next, currentPin: hasPin ? current : undefined });
      await qc.invalidateQueries();
      close();
      onCode(code);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title={hasPin ? 'تغيير رمز الدخول' : 'تفعيل رمز دخول الإدارة'} centered size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Stack>
          {hasPin && (
            <PasswordInput
              label="الرمز الحالي"
              data-autofocus
              value={current}
              onChange={(e) => setCurrent(cleanPin(e.currentTarget.value))}
              {...PIN_PROPS}
            />
          )}
          <PasswordInput
            label="الرمز الجديد (4 إلى 8 أرقام)"
            data-autofocus={!hasPin}
            value={next}
            onChange={(e) => setNext(cleanPin(e.currentTarget.value))}
            {...PIN_PROPS}
          />
          <PasswordInput
            label="تأكيد الرمز الجديد"
            value={confirm}
            error={mismatch ? 'الرمزان غير متطابقين' : undefined}
            onChange={(e) => setConfirm(cleanPin(e.currentTarget.value))}
            {...PIN_PROPS}
          />
          {error && <Text c="red.8" size="sm">{error}</Text>}
          <Button type="submit" loading={busy} disabled={next.length < 4 || next !== confirm || (hasPin && current.length < 4)}>
            حفظ
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

/** Turn the PIN off (needs the current PIN). */
export function RemovePinModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const close = () => {
    setPinValue('');
    setError(null);
    onClose();
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await removePin(pin);
      await qc.invalidateQueries();
      close();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal opened={opened} onClose={close} title="إلغاء رمز الدخول" centered size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Stack>
          <Alert color="orange" variant="light">
            بعد الإلغاء يمكن لأي شخص فتح الإدارة.
          </Alert>
          <PasswordInput
            label="أدخل الرمز الحالي للتأكيد"
            data-autofocus
            value={pin}
            onChange={(e) => setPinValue(cleanPin(e.currentTarget.value))}
            error={error}
            {...PIN_PROPS}
          />
          <Group justify="flex-end">
            <Button type="submit" color="red" loading={busy} disabled={pin.length < 4}>
              إلغاء الرمز
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

export function notifyError(error: unknown) {
  notifications.show({ color: 'red', title: 'خطأ', message: String(error) });
}

/**
 * Wraps `useMutation`: on success invalidates every query and shows a green notification
 * (`successMessage` may depend on the result; pass `null` to skip it); on error shows a red one.
 */
export function useMutate<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  successMessage: string | null | ((result: TResult) => string) = 'تم الحفظ',
  onSuccess?: (result: TResult) => void,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await qc.invalidateQueries();
      const msg = typeof successMessage === 'function' ? successMessage(result) : successMessage;
      if (msg) notifications.show({ color: 'green', message: msg });
      onSuccess?.(result);
    },
    onError: notifyError,
  });
}

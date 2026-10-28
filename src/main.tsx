import React from 'react';
import ReactDOM from 'react-dom/client';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import './global.css';

import App from './App';

dayjs.locale('ar');

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DirectionProvider initialDirection="rtl" detectDirection={false}>
      <MantineProvider
        theme={{
          fontFamily: 'Cairo, sans-serif',
          headings: { fontFamily: 'Cairo, sans-serif' },
          primaryColor: 'orange',
          defaultRadius: 'md',
        }}
      >
        <DatesProvider settings={{ locale: 'ar' }}>
          <QueryClientProvider client={queryClient}>
            <ModalsProvider labels={{ confirm: 'تأكيد', cancel: 'إلغاء' }}>
              {/* top-center: top-left would cover the POS/admin switch button in the RTL header. */}
              <Notifications position="top-center" />
              <App />
            </ModalsProvider>
          </QueryClientProvider>
        </DatesProvider>
      </MantineProvider>
    </DirectionProvider>
  </React.StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { DirectionProvider, MantineProvider, createTheme, type CSSVariablesResolver } from '@mantine/core';
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

// Mantine's default 7–9 shades of these hues fail WCAG AA as text on white and under white
// button labels (e.g. orange.7 3.0:1, green.8 3.4:1). Shades 0–6 stay stock; 7–9 are darkened
// so `c="orange.9"` / `green.8` / `red.8` text and filled buttons reach ≥4.5:1.
const theme = createTheme({
  fontFamily: 'Cairo, sans-serif',
  headings: { fontFamily: 'Cairo, sans-serif' },
  primaryColor: 'orange',
  primaryShade: { light: 7, dark: 8 },
  defaultRadius: 'md',
  autoContrast: true,
  // Black/white contrast cross over at relative luminance ≈0.179; switching there makes
  // autoContrast always pick the label colour with ≥4.58:1 for any filled colour.
  luminanceThreshold: 0.179,
  colors: {
    orange: ['#fff4e6', '#ffe8cc', '#ffd8a8', '#ffc078', '#ffa94d', '#ff922b', '#fd7e14', '#c2410c', '#ad3a0c', '#9a3412'],
    green: ['#ebfbee', '#d3f9d8', '#b2f2bb', '#8ce99a', '#69db7c', '#51cf66', '#40c057', '#237a35', '#1e6b2e', '#185a27'],
    red: ['#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787', '#ff6b6b', '#fa5252', '#c92a2a', '#b02525', '#8f1f1f'],
  },
});

// Stock dimmed (gray.6, 3.3:1) and placeholder (gray.5, 2.1:1) are too faint for secondary text.
const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { '--mantine-color-dimmed': '#5c636a', '--mantine-color-placeholder': '#6c757d' },
  dark: {},
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DirectionProvider initialDirection="rtl" detectDirection={false}>
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver}>
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

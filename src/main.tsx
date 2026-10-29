import React from 'react';
import ReactDOM from 'react-dom/client';
import { DirectionProvider, MantineProvider, createTheme, type CSSVariablesResolver } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/600.css';
import '@fontsource/readex-pro/700.css';
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

// Light-only, pastel palette (lavender / mint / pink / sky / lilac) on an off-white canvas.
// Shades 0–6 are pastel surfaces; 7–9 are deep tones that keep ≥4.5:1 as text or under white labels.
// Semantic orange/green/red keep darkened 7–9 shades for the same reason.
const theme = createTheme({
  fontFamily: '"Readex Pro", sans-serif',
  headings: { fontFamily: '"Readex Pro", sans-serif' },
  primaryColor: 'lav',
  primaryShade: { light: 7, dark: 8 },
  defaultRadius: 'lg',
  autoContrast: true,
  // Black/white contrast cross over at relative luminance ≈0.179; switching there makes
  // autoContrast always pick the label colour with ≥4.58:1 for any filled colour.
  luminanceThreshold: 0.179,
  colors: {
    lav: ['#f4f4fd', '#e6e6f9', '#d3d3f4', '#c9c9f0', '#b4b4e8', '#9d9de0', '#8685d4', '#5b59c4', '#4a48ab', '#3b3a8c'],
    mint: ['#f1faf7', '#e1f4ee', '#d0eee5', '#c3e8dc', '#a9ddcc', '#8fd0bc', '#74c2aa', '#2f7d66', '#27695a', '#1f5548'],
    pink: ['#fef5f9', '#fde8f0', '#fbd9e7', '#f8c8dc', '#f3adc9', '#ee92b6', '#e676a2', '#b53a73', '#9a2f61', '#7d264e'],
    sky: ['#f2f9fd', '#e2f1f9', '#d3e9f5', '#c5e1f0', '#a8d3e8', '#8bc4e0', '#6eb4d6', '#2f7399', '#285f80', '#214d68'],
    lilac: ['#faf5fd', '#f2e8f9', '#ecdcf5', '#e3cff0', '#d5b8e7', '#c6a1dd', '#b789d2', '#7b4a9e', '#673d85', '#53326d'],
    orange: ['#fff4e6', '#ffe8cc', '#ffd8a8', '#ffc078', '#ffa94d', '#ff922b', '#fd7e14', '#c2410c', '#ad3a0c', '#9a3412'],
    green: ['#ebfbee', '#d3f9d8', '#b2f2bb', '#8ce99a', '#69db7c', '#51cf66', '#40c057', '#237a35', '#1e6b2e', '#185a27'],
    red: ['#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787', '#ff6b6b', '#fa5252', '#c92a2a', '#b02525', '#8f1f1f'],
  },
});

// Off-white canvas; dimmed/placeholder text darkened (stock gray.6 is 3.3:1, gray.5 is 2.1:1).
const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': '#f8f8fb',
    '--mantine-color-text': '#1d1d22',
    '--mantine-color-dimmed': '#5c636a',
    '--mantine-color-placeholder': '#6c757d',
  },
  dark: {},
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DirectionProvider initialDirection="rtl" detectDirection={false}>
      <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light">
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

import { defineConfig, devices } from '@playwright/test';

// Abläufe gegen den Produktions-Build (vite preview mit denselben Headern wie beim Hoster, also echter CSP).
// Handy 390 px und Desktop 1280 px, je hell und dunkel. Reduzierte Bewegung für stabile Bilder,
// feste Uhr aus e2e/fixtures.ts. Service Worker nur im eigenen PWA-Test.
const base = { ...devices['Desktop Chrome'], reducedMotion: 'reduce' as const, locale: 'de-CH', timezoneId: 'Europe/Zurich', serviceWorkers: 'block' as const };
const phone = { ...base, viewport: { width: 390, height: 844 } };
const desktop = { ...base, viewport: { width: 1280, height: 800 } };

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL: 'http://localhost:5180', trace: 'retain-on-failure' },
  projects: [
    { name: 'handy-hell', use: { ...phone, colorScheme: 'light' } },
    { name: 'handy-dunkel', use: { ...phone, colorScheme: 'dark' } },
    { name: 'desktop-hell', use: { ...desktop, colorScheme: 'light' } },
    { name: 'desktop-dunkel', use: { ...desktop, colorScheme: 'dark' } },
  ],
  webServer: {
    // In CI ist schon gebaut (npm run build). Lokal wird vorher gebaut.
    command: process.env.CI ? 'npx vite preview --port 5180 --strictPort' : 'npx vite build && npx vite preview --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

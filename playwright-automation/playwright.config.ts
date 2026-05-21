import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  //reporter: 'html',
  //harry changed above line 12 FEB 2026
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: (() => {
        const { deviceScaleFactor: _, ...chromeDevice } = devices['Desktop Chrome'];
        return {
          ...chromeDevice,
          channel: 'chrome',
          viewport: null,
          launchOptions: {
            args: ['--start-maximized'],
          },
        };
      })(),
    },
    {
      name: 'kiosk',
      testMatch: /.*kiosk-.*\.spec\.ts/,
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 1080, height: 1920 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: true,
        launchOptions: {
          args: [
            '--window-size=540,960',
            '--window-position=0,0',
            '--force-device-scale-factor=0.5',
            '--disable-features=HudDisplayForPerformanceMetrics',
            '--hide-scrollbars',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
    },
    {
      name: 'kiosk-scaled',
      testMatch: /.*kiosk-.*\.spec\.ts/,
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 1080, height: 1920 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: true,
        launchOptions: {
          args: [
            '--window-size=540,960',
            '--window-position=0,0',
            '--force-device-scale-factor=0.5',
            '--disable-features=HudDisplayForPerformanceMetrics',
            '--hide-scrollbars',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
    },

   /* {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },*/

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

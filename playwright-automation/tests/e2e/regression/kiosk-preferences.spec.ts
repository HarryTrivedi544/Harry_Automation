/// <reference types="node" />
import { test, expect } from '@playwright/test';
import { loadTestData } from '../../../config/testData';
import { getCredentialProfileCredentials } from '../../../config/users';
import { KioskAdminPage } from '../../../pages/kioskAdmin.page';

const kioskDevice = {
  viewport: { width: 1080, height: 1920 },
  screen: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: true,
  defaultBrowserType: 'chromium' as const,
};

test.describe.configure({ timeout: 120_000 });

test.use({
  ...kioskDevice,
});

test.describe('Kiosk admin preferences', () => {
  test('updates kiosk box id @regression', async ({ page }, testInfo) => {
    const kioskUrl = process.env.KIOSK_STAGE_URL?.trim();
    if (!kioskUrl) {
      throw new Error('Missing KIOSK_STAGE_URL in .env.');
    }

    const testData = loadTestData({
      environment: 'stage',
      userRole: 'admin',
      credentialProfile: 'admin',
      testCaseId: 'kiosk-preferences',
      scenario: 'default',
    });
    const credentials = getCredentialProfileCredentials('admin');
    const kioskAdminPage = new KioskAdminPage(page);

    await test.step('Set kiosk device dimensions and open kiosk home', async () => {
      await kioskAdminPage.goto(kioskUrl);
      const dimensions = await kioskAdminPage.getKioskDimensions();
      const viewportSize = page.viewportSize();
      const dimensionReport = { viewportSize, ...dimensions };

      console.log(`Kiosk dimensions: ${JSON.stringify(dimensionReport)}`);
      await testInfo.attach('kiosk-dimensions', {
        body: JSON.stringify(dimensionReport, null, 2),
        contentType: 'application/json',
      });
    });

    await test.step('Open admin login', async () => {
      await kioskAdminPage.openAdminLogin();
    });

    await test.step('Sign in as kiosk admin', async () => {
      await kioskAdminPage.signIn(credentials);
    });

    await test.step('Open kiosk preference update', async () => {
      await kioskAdminPage.openPreferenceUpdate();
    });

    await test.step('Update kiosk box id and save', async () => {
      await kioskAdminPage.saveKioskBoxId(testData.required('kioskBoxId'));
    });

    await test.step('Return and exit admin menu', async () => {
      await kioskAdminPage.goBack();
      await kioskAdminPage.exitAdminMenu();
    });

    await expect(page).toHaveURL(/\/kiosk\/home\/?/);
  });
});

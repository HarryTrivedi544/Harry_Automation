/// <reference types="node" />
import { test, expect } from '@playwright/test';
import { loadTestData } from '../../../config/testData';
import { getCredentialProfileCredentials } from '../../../config/users';
import { KioskAdminPage } from '../../../pages/kioskAdmin.page';
import { KioskPickupPage } from '../../../pages/kioskPickup.page';

const kioskDevice = {
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: true,
  defaultBrowserType: 'chromium' as const,
};

test.describe.configure({ timeout: 180_000 });

test.use({
  ...kioskDevice,
});

test.describe('Kiosk pickup order', () => {
  test('completes pickup order and survey @regression', async ({ page }, testInfo) => {
    const kioskUrl = process.env.KIOSK_STAGE_URL?.trim();
    if (!kioskUrl) {
      throw new Error('Missing KIOSK_STAGE_URL in .env.');
    }

    const kioskAdminData = loadTestData({
      environment: 'stage',
      userRole: 'admin',
      credentialProfile: 'admin',
      testCaseId: 'kiosk-preferences',
      scenario: 'default',
    });
    const pickupData = loadTestData({
      environment: 'stage',
      userRole: 'admin',
      credentialProfile: 'admin',
      testCaseId: 'kiosk-pickup-order',
      scenario: 'default',
    });
    const credentials = getCredentialProfileCredentials('admin');
    const kioskAdminPage = new KioskAdminPage(page);
    const kioskPickupPage = new KioskPickupPage(page);

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

    await test.step('Run KioskAdmin prerequisite', async () => {
      await kioskAdminPage.openAdminLogin();
      await kioskAdminPage.signIn(credentials);
      await kioskAdminPage.openPreferenceUpdate();
      await kioskAdminPage.saveKioskBoxId(kioskAdminData.required('kioskBoxId'));
      await kioskAdminPage.goBack();
      await kioskAdminPage.exitAdminMenu();
      await expect(page).toHaveURL(/\/kiosk\/home\/?/);
    });

    await test.step('Start pickup flow', async () => {
      await kioskPickupPage.startPickup();
    });

    await test.step('Enter pickup code and PIN', async () => {
      await kioskPickupPage.enterPickupCode(pickupData.required('pickupCode'));
      await kioskPickupPage.enterPin(pickupData.required('pin'));
      await kioskPickupPage.confirmIdentity();
    });

    await test.step('Sign and complete pickup', async () => {
      await kioskPickupPage.signPickup();
      await kioskPickupPage.completePickup();
    });
  });
});

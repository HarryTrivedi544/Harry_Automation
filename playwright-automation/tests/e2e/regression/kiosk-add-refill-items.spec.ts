/// <reference types="node" />
import { test, expect } from '@playwright/test';
import { loadTestData } from '../../../config/testData';
import { getCredentialProfileCredentials } from '../../../config/users';
import { KioskAdminPage } from '../../../pages/kioskAdmin.page';

const kioskDevice = {
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: true,
  defaultBrowserType: 'chromium' as const,
};

test.describe.configure({ timeout: 120_000 });

test.use({
  ...kioskDevice,
});

test.describe('Kiosk admin add or refill items', () => {
  test('loads stock code from admin stock flow @regression', async ({ page }, testInfo) => {
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
    const addRefillData = loadTestData({
      environment: 'stage',
      userRole: 'admin',
      credentialProfile: 'admin',
      testCaseId: 'kiosk-add-refill-items',
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

    await test.step('Run KioskAdmin prerequisite', async () => {
      await kioskAdminPage.openAdminLogin();
      await kioskAdminPage.signIn(credentials);
      await kioskAdminPage.openPreferenceUpdate();
      await kioskAdminPage.saveKioskBoxId(kioskAdminData.required('kioskBoxId'));
      await kioskAdminPage.goBack();
      await kioskAdminPage.exitAdminMenu();
      await expect(page).toHaveURL(/\/kiosk\/home\/?/);
    });

    await test.step('Open stock admin login', async () => {
      await kioskAdminPage.openStockAdminLogin();
    });

    await test.step('Sign in as kiosk admin', async () => {
      await kioskAdminPage.signIn(credentials);
    });

    await test.step('Open add or refill items', async () => {
      await kioskAdminPage.openAddOrRefillItems();
    });

    await test.step('Load stock code', async () => {
      await kioskAdminPage.loadStockCode(addRefillData.required('stockCode'));
    });

    await test.step('Exit stock flow and admin menu', async () => {
      await kioskAdminPage.goBack();
      await kioskAdminPage.exitStockFlowAnyway();
      await kioskAdminPage.seeYouSoon();
    });

    await expect(page).toHaveURL(/\/kiosk\/home\/?/);
  });
});

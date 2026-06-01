/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { chromium, test, expect, type Browser, type Page } from '@playwright/test';
import { loadTestData } from '../../../config/testData';
import { resolveTestSetup, type TestSetup } from '../../../config/testSetups';
import { getCredentialProfileCredentials } from '../../../config/users';
import { DeliverPrescriptionPage } from '../../../pages/deliverPrescription.page';
import { KioskAdminPage } from '../../../pages/kioskAdmin.page';
import { KioskVerifyPage } from '../../../pages/kioskVerify.page';
import { LoginPage } from '../../../pages/login.page';

type SuiteStockCodes = {
  stockCode: string;
  pickupCode: string;
};

const pharmacySetup: TestSetup = {
  environment: 'stage',
  userRole: 'admin',
  credentialProfile: 'admin',
  testCaseId: 'pharmacy-stock',
  scenario: 'default',
};

test.describe.configure({ timeout: 420_000 });

test.describe('Verify stocked items', () => {
  test('verify-tems @regression', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Run this suite with the chromium project. Kiosk steps create their own scaled kiosk browser.');

    const kioskUrl = process.env.KIOSK_STAGE_URL?.trim();
    if (!kioskUrl) {
      throw new Error('Missing KIOSK_STAGE_URL in .env.');
    }

    const pharmacyData = loadTestData(pharmacySetup);
    const kioskAdminData = loadTestData({
      environment: 'stage',
      userRole: 'admin',
      credentialProfile: 'admin',
      testCaseId: 'kiosk-preferences',
      scenario: 'default',
    });
    const resolvedPharmacySetup = resolveTestSetup(pharmacySetup);
    const pharmacyLogin = new LoginPage(page);
    const deliverPrescriptionPage = new DeliverPrescriptionPage(page);
    const kioskCredentials = getCredentialProfileCredentials('admin');
    let kioskBrowser: Browser | undefined;
    let kioskPage: Page | undefined;
    let suiteCodes: SuiteStockCodes | undefined;

    try {
      await test.step('Run stock and capture stock and pickup codes', async () => {
        await grantPharmacyPermissions(page, resolvedPharmacySetup.baseUrl);
        await pharmacyLogin.goto(resolvedPharmacySetup.baseUrl);
        await pharmacyLogin.login(resolvedPharmacySetup.user.username, resolvedPharmacySetup.user.password);
        await expect(page).toHaveURL(/\/home\/?/);
        await deliverPrescriptionPage.gotoDeliverPrescription();

        const rxNumbers = pharmacyData
          .get('rxNumbers', pharmacyData.required('rxNumber'))
          ?.split(',')
          .map((rxNumber) => rxNumber.trim())
          .filter(Boolean) ?? [];
        const triggeredRxNumber = await deliverPrescriptionPage.scanPrescription(rxNumbers);

        suiteCodes = await deliverPrescriptionPage.assignBin(pharmacyData.required('binLocation'));
        await deliverPrescriptionPage.save();

        console.log(`Triggered RX: ${triggeredRxNumber}`);
        console.log(`Stock Code: ${suiteCodes.stockCode}`);
        console.log(`P/U Code: ${suiteCodes.pickupCode}`);

        await testInfo.attach('verify-stocked-items-triggered-rx', {
          body: triggeredRxNumber,
          contentType: 'text/plain',
        });
        await testInfo.attach('verify-stocked-items-codes', {
          body: JSON.stringify(suiteCodes, null, 2),
          contentType: 'application/json',
        });
      });

      await test.step('Save captured stock and pickup codes locally', async () => {
        const codes = requireSuiteCodes(suiteCodes);
        const runtimeFilePath = saveSuiteCodes(codes);

        await testInfo.attach('verify-stocked-items-codes-file', {
          body: runtimeFilePath,
          contentType: 'text/plain',
        });
      });

      await test.step('Open scaled kiosk browser', async () => {
        const kioskBrowserPage = await createScaledKioskPage();

        kioskBrowser = kioskBrowserPage.browser;
        kioskPage = kioskBrowserPage.page;
      });

      await test.step('Run KioskAdmin prerequisite once', async () => {
        const activeKioskPage = requireKioskPage(kioskPage);
        const kioskAdminPage = new KioskAdminPage(activeKioskPage);

        await kioskAdminPage.goto(kioskUrl);
        const dimensions = await kioskAdminPage.getKioskDimensions();
        const dimensionReport = { viewportSize: activeKioskPage.viewportSize(), ...dimensions };

        console.log(`Kiosk dimensions: ${JSON.stringify(dimensionReport)}`);
        await testInfo.attach('kiosk-dimensions', {
          body: JSON.stringify(dimensionReport, null, 2),
          contentType: 'application/json',
        });

        await kioskAdminPage.openAdminLogin();
        await kioskAdminPage.signIn(kioskCredentials);
        await kioskAdminPage.openPreferenceUpdate();
        await kioskAdminPage.saveKioskBoxId(kioskAdminData.required('kioskBoxId'));
        await kioskAdminPage.goBack();
        await kioskAdminPage.exitAdminMenu();
        await expect(activeKioskPage).toHaveURL(/\/kiosk\/home\/?/);
      });

      await test.step('Run kiosk add or refill items with captured stock code', async () => {
        const codes = requireSuiteCodes(suiteCodes);
        const activeKioskPage = requireKioskPage(kioskPage);
        const kioskAdminPage = new KioskAdminPage(activeKioskPage);

        await kioskAdminPage.openStockAdminLogin();
        await kioskAdminPage.signIn(kioskCredentials);
        await kioskAdminPage.openAddOrRefillItems();
        await kioskAdminPage.loadStockCode(codes.stockCode);
        await kioskAdminPage.goBack();
        await kioskAdminPage.exitStockFlowAnyway();
        await kioskAdminPage.seeYouSoon();
        await expect(activeKioskPage).toHaveURL(/\/kiosk\/home\/?/);
      });

      await test.step('Verify stocked item with captured stock code', async () => {
        const codes = requireSuiteCodes(suiteCodes);
        const activeKioskPage = requireKioskPage(kioskPage);
        const kioskAdminPage = new KioskAdminPage(activeKioskPage);
        const kioskVerifyPage = new KioskVerifyPage(activeKioskPage);

        await kioskAdminPage.openAdminLogin();
        await expect(activeKioskPage).toHaveURL(/\/admin\/secure-badge-login\/?/, { timeout: 30_000 });
        await kioskAdminPage.signIn(kioskCredentials);
        await expect(activeKioskPage).toHaveURL(/\/admin\/panel\/?/, { timeout: 30_000 });
        await kioskVerifyPage.openVerify();
        await kioskVerifyPage.verifyStockCode(codes.stockCode);
        await kioskVerifyPage.exitVerifyFlow();
      });
    } finally {
      await kioskBrowser?.close().catch(() => undefined);
    }
  });
});

function requireSuiteCodes(codes: SuiteStockCodes | undefined): SuiteStockCodes {
  if (!codes?.stockCode || !codes.pickupCode) {
    throw new Error('Stock did not generate stock code and pickup code for the suite.');
  }

  return codes;
}

function saveSuiteCodes(codes: SuiteStockCodes): string {
  const runtimeDir = path.resolve(process.cwd(), 'test-results', 'runtime');
  const runtimeFilePath = path.join(runtimeDir, 'verify-stocked-items-codes.json');

  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(
    runtimeFilePath,
    `${JSON.stringify(
      {
        ...codes,
        savedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return runtimeFilePath;
}

function requireKioskPage(page: Page | undefined): Page {
  if (!page) {
    throw new Error('Scaled kiosk browser page was not created.');
  }

  return page;
}

async function createScaledKioskPage(): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      '--window-size=540,960',
      '--window-position=0,0',
      '--force-device-scale-factor=0.5',
      '--disable-features=HudDisplayForPerformanceMetrics',
      '--hide-scrollbars',
      '--use-fake-ui-for-media-stream',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: true,
  });
  const page = await context.newPage();

  return { browser, page };
}

async function grantPharmacyPermissions(page: Page, url: string): Promise<void> {
  const origin = new URL(url).origin;

  await page.context().grantPermissions(['camera', 'microphone'], { origin });
}

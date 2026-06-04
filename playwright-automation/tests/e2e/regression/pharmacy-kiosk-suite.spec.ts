/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { chromium, test, expect, type Browser, type Page } from '@playwright/test';
import { loadTestData } from '../../../config/testData';
import { loadRuntimeEnvironments, resolveRuntimeEnvironment } from '../../../config/runtimeEnvironments';
import { resolveTestSetup, type TestSetup } from '../../../config/testSetups';
import { getCredentialProfileCredentials } from '../../../config/users';
import { DeliverPrescriptionPage } from '../../../pages/deliverPrescription.page';
import { KioskAdminPage } from '../../../pages/kioskAdmin.page';
import { KioskPickupPage } from '../../../pages/kioskPickup.page';
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

test.describe('Pharmacy to kiosk run suite', () => {
  for (const runtimeInput of loadRuntimeEnvironments()) {
  test(`delivers prescription, refills kiosk stock, and completes pickup [${runtimeInput.name}] @regression`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Run this suite with the chromium project. Kiosk steps create their own scaled kiosk browser.');

    const pharmacyData = loadTestData(pharmacySetup);
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
    const pharmacyLogin = new LoginPage(page);
    const runtimeEnvironment = resolveRuntimeEnvironment(runtimeInput, {
      webUrl: () => resolveTestSetup(pharmacySetup).baseUrl,
      kioskUrl: requireDefaultKioskUrl,
      boxId: () => kioskAdminData.required('kioskBoxId'),
      credentials: () => getCredentialProfileCredentials('admin'),
    });
    const deliverPrescriptionPage = new DeliverPrescriptionPage(page);
    let kioskBrowser: Browser | undefined;
    let kioskPage: Page | undefined;
    let suiteCodes: SuiteStockCodes | undefined;

    try {
      await test.step('Run deliver prescription and capture stock codes', async () => {
        await grantPharmacyPermissions(page, runtimeEnvironment.webUrl);
        await pharmacyLogin.goto(runtimeEnvironment.webUrl);
        await pharmacyLogin.login(runtimeEnvironment.credentials.username, runtimeEnvironment.credentials.password);
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

        await testInfo.attach('pharmacy-stock-triggered-rx', {
          body: triggeredRxNumber,
          contentType: 'text/plain',
        });
        await testInfo.attach('pharmacy-stock-codes', {
          body: JSON.stringify(suiteCodes, null, 2),
          contentType: 'application/json',
        });
      });

      await test.step('Save captured stock codes locally', async () => {
        const codes = requireSuiteCodes(suiteCodes);
        const runtimeFilePath = saveSuiteCodes(codes);

        await testInfo.attach('pharmacy-kiosk-suite-codes-file', {
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

        await kioskAdminPage.goto(runtimeEnvironment.kioskUrl);
        const dimensions = await kioskAdminPage.getKioskDimensions();
        const dimensionReport = { viewportSize: activeKioskPage.viewportSize(), ...dimensions };

        console.log(`Kiosk dimensions: ${JSON.stringify(dimensionReport)}`);
        await testInfo.attach('kiosk-dimensions', {
          body: JSON.stringify(dimensionReport, null, 2),
          contentType: 'application/json',
        });

        await kioskAdminPage.openAdminLogin();
        await kioskAdminPage.signIn(runtimeEnvironment.credentials);
        await kioskAdminPage.openPreferenceUpdate();
        await kioskAdminPage.saveKioskBoxId(runtimeEnvironment.boxId);
        await kioskAdminPage.goBack();
        await kioskAdminPage.exitAdminMenu();
        await expect(activeKioskPage).toHaveURL(/\/kiosk\/home\/?/);
      });

      await test.step('Run kiosk add or refill items with captured stock code', async () => {
        const codes = requireSuiteCodes(suiteCodes);
        const activeKioskPage = requireKioskPage(kioskPage);
        const kioskAdminPage = new KioskAdminPage(activeKioskPage);

        await kioskAdminPage.openStockAdminLogin();
        await kioskAdminPage.signIn(runtimeEnvironment.credentials);
        await kioskAdminPage.openAddOrRefillItems();
        await kioskAdminPage.loadStockCode(codes.stockCode);
        await kioskAdminPage.goBack();
        await kioskAdminPage.exitStockFlowAnyway();
        await kioskAdminPage.seeYouSoon();
        await expect(activeKioskPage).toHaveURL(/\/kiosk\/home\/?/);
      });

      await test.step('Run kiosk pickup with captured pickup code', async () => {
        const codes = requireSuiteCodes(suiteCodes);
        const activeKioskPage = requireKioskPage(kioskPage);
        const kioskPickupPage = new KioskPickupPage(activeKioskPage);

        await kioskPickupPage.startPickup();
        await kioskPickupPage.enterPickupCode(codes.pickupCode);
        await kioskPickupPage.enterPin(pickupData.required('pin'));
        await kioskPickupPage.confirmIdentity();
        await kioskPickupPage.signPickup();
        await kioskPickupPage.completePickup();
      });
    } finally {
      await kioskBrowser?.close().catch(() => undefined);
    }
  });
  }
});

function requireSuiteCodes(codes: SuiteStockCodes | undefined): SuiteStockCodes {
  if (!codes?.stockCode || !codes.pickupCode) {
    throw new Error('Deliver prescription did not generate stock code and pickup code for the suite.');
  }

  return codes;
}

function saveSuiteCodes(codes: SuiteStockCodes): string {
  const runtimeDir = path.resolve(process.cwd(), 'test-results', 'runtime');
  const runtimeFilePath = path.join(runtimeDir, 'pharmacy-kiosk-suite-codes.json');

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

function requireDefaultKioskUrl(): string {
  const kioskUrl = process.env.KIOSK_STAGE_URL?.trim();

  if (!kioskUrl) {
    throw new Error('Missing KIOSK_STAGE_URL in .env.');
  }

  return kioskUrl;
}

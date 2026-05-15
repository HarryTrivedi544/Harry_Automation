/// <reference types="node" />
import { test, expect } from '../../../fixtures/baseTest';
import { ReportsPage } from '../../../pages/reports.page';

test.describe.configure({ timeout: 120_000 });

test.describe('Stock list reports', () => {
  test.use({
    testSetup: {
      environment: 'stage',
      userRole: 'admin',
      credentialProfile: 'admin',
      testCaseId: 'stock-list-export',
      scenario: 'default',
    },
  });

  test('exports stock list CSV @regression', async ({ page, loginPage: _loginPage, testData }, testInfo) => {
    const reportsPage = new ReportsPage(page);

    await test.step('Confirm authenticated home page is loaded', async () => {
      await expect(page).toHaveURL(/\/home\/?/);
    });

    await test.step('Dismiss optional prompt and open reports', async () => {
      await reportsPage.dismissOptionalPrompt();
      await reportsPage.openReportMenu();
    });

    await test.step('Open stock list report', async () => {
      await reportsPage.gotoStockListReport();
    });

    await test.step('Export stock list CSV', async () => {
      const download = await reportsPage.exportStockListCsv();
      await testInfo.attach('stock-list-export-filename', {
        body: download.suggestedFilename(),
        contentType: 'text/plain',
      });
      expect(download.suggestedFilename()).toContain(testData.required('expectedFileExtension'));
    });
  });
});

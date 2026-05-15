/// <reference types="node" />
import { test, expect } from '../../../fixtures/baseTest';
import { DeliverPrescriptionPage } from '../../../pages/deliverPrescription.page';

test.describe.configure({ timeout: 120_000 });

test.describe('Pharmacy side stock', () => {
  test.use({
    testSetup: {
      environment: 'stage',
      userRole: 'admin',
      credentialProfile: 'admin',
      testCaseId: 'pharmacy-stock',
      scenario: 'default',
    },
  });

  test('pharmacy stock test case @regression', async ({ page, loginPage: _loginPage, testData }, testInfo) => {
    const deliverPrescriptionPage = new DeliverPrescriptionPage(page);

    await test.step('Open deliver prescription workflow', async () => {
      await expect(page).toHaveURL(/\/home\/?/);
      await deliverPrescriptionPage.gotoDeliverPrescription();
    });

    await test.step('Scan prescription from test data', async () => {
      const rxNumbers = testData
        .get('rxNumbers', testData.required('rxNumber'))
        ?.split(',')
        .map((rxNumber) => rxNumber.trim())
        .filter(Boolean) ?? [];
      const triggeredRxNumber = await deliverPrescriptionPage.scanPrescription(rxNumbers);

      console.log(`Triggered RX: ${triggeredRxNumber}`);
      await testInfo.attach('pharmacy-stock-triggered-rx', {
        body: triggeredRxNumber,
        contentType: 'text/plain',
      });
    });

    await test.step('Assign bin and capture stock codes', async () => {
      const codes = await deliverPrescriptionPage.assignBin(testData.required('binLocation'));

      console.log(`Stock Code: ${codes.stockCode}`);
      console.log(`P/U Code: ${codes.pickupCode}`);

      await testInfo.attach('pharmacy-stock-codes', {
        body: JSON.stringify(codes, null, 2),
        contentType: 'application/json',
      });
    });

    await test.step('Save stocked prescription', async () => {
      await deliverPrescriptionPage.save();
    });
  });
});

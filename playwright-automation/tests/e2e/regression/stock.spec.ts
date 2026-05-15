/// <reference types="node" />
import { test, expect } from '../../../fixtures/baseTest';

test.describe.configure({ timeout: 120_000 });

test.describe('Pharmacy side stock', () => {
  test('pharmacy stock test case', async ({ page, loginPage }) => {
    await page.waitForTimeout(15_000);
    const notNowButton = page.getByRole('button', { name: 'NOT NOW' });
    if (await notNowButton.isVisible()) {
      await notNowButton.click();
    }
    await page.getByText('Deliver Prescription', { exact: true }).click();
    await page.waitForTimeout(10_000);
    await page.getByTestId('MenuIcon').click();
    await page.getByLabel('Scan RX Now').fill('a22222');
    await page.getByText('E 5', { exact: true }).click();
    await page.waitForTimeout(5_000);
    const stockCodeLocator = page.locator('xpath=//td[contains(., "Stock Code:")]//span[last()]');
    const stockCode = (await stockCodeLocator.textContent())?.trim() ?? '';
    console.log('Stock Code:', stockCode);
    const pickupCodeLocator = page.locator('xpath=//td[contains(., "P/U Code:")]//span[last()]');
    const pickupCode = (await pickupCodeLocator.textContent())?.trim() ?? '';
       console.log('Pickup Code:', pickupCode);
       const saveButton = page.getByText('SAVE', { exact: true });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();
    await page.waitForTimeout(10_000);
  });
});

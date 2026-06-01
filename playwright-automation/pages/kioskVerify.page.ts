import { expect, type Locator, type Page } from '@playwright/test';

const kioskActionDelayMs = 5_000;

export class KioskVerifyPage {
  readonly page: Page;
  readonly verifyAction: Locator;
  readonly stockCodeInput: Locator;
  readonly verifySelectedButton: Locator;
  readonly yesButton: Locator;
  readonly okButton: Locator;
  readonly backButton: Locator;
  readonly exitAnywayButton: Locator;
  readonly exitAction: Locator;

  constructor(page: Page) {
    this.page = page;
    this.verifyAction = page.getByText('Verify', { exact: true });
    this.stockCodeInput = page.getByPlaceholder('Scan or Enter your code here.');
    this.verifySelectedButton = page.getByRole('button', { name: 'Verify Selected', exact: true });
    this.yesButton = page.getByRole('button', { name: 'Yes', exact: true });
    this.okButton = page.getByRole('button', { name: 'Ok', exact: true });
    this.backButton = page.getByRole('button', { name: 'Back', exact: true });
    this.exitAnywayButton = page.getByRole('button', { name: 'Exit Anyway', exact: true });
    this.exitAction = page.getByText('Exit', { exact: true });
  }

  async openVerify(): Promise<void> {
    await expect(this.verifyAction).toBeVisible({ timeout: 30_000 });
    await this.verifyAction.click();
    await expect(this.page).toHaveURL(/\/admin\/verify\/?/, { timeout: 30_000 });
  }

  async verifyStockCode(stockCode: string): Promise<void> {
    await expect(this.stockCodeInput).toBeEditable({ timeout: 30_000 });
    await this.stockCodeInput.fill(stockCode);
    await expect(this.verifySelectedButton).toBeEnabled({ timeout: 30_000 });
    await this.verifySelectedButton.click();
    await expect(this.yesButton).toBeVisible({ timeout: 30_000 });
    await this.yesButton.click();
    await expect(this.yesButton).toBeVisible({ timeout: 30_000 });
    await this.yesButton.click();
    await expect(this.okButton).toBeVisible({ timeout: 30_000 });
    await this.okButton.click();
    await this.page.waitForTimeout(kioskActionDelayMs);
  }

  async exitVerifyFlow(): Promise<void> {
    await expect(this.backButton).toBeVisible({ timeout: 30_000 });
    await this.backButton.click();
    await expect(this.exitAnywayButton).toBeVisible({ timeout: 30_000 });
    await this.exitAnywayButton.click();
    await expect(this.page).toHaveURL(/\/admin\/panel\/?/, { timeout: 30_000 });
    await expect(this.exitAction).toBeVisible({ timeout: 30_000 });
    await this.exitAction.click();
    await expect(this.page).toHaveURL(/\/kiosk\/home\/?/, { timeout: 30_000 });
  }
}

import { expect, type Download, type Locator, type Page } from '@playwright/test';

export class ReportsPage {
  readonly page: Page;
  readonly notNowButton: Locator;
  readonly reportMenuButton: Locator;
  readonly exportCsvButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.notNowButton = page.getByRole('button', { name: 'NOT NOW' });
    this.reportMenuButton = page.locator("//div[normalize-space(.)='Report' and @role='button']");
    this.exportCsvButton = page.getByRole('button', { name: 'ExportCSV' });
  }

  async dismissOptionalPrompt(): Promise<void> {
    try {
      await expect(this.notNowButton).toBeVisible({ timeout: 3_000 });
      await this.notNowButton.click();
    } catch {
      // The consultation prompt is optional and can appear after navigation settles.
    }
  }

  async openReportMenu(): Promise<void> {
    await expect(this.reportMenuButton).toBeVisible();
    await this.reportMenuButton.click();
  }

  async gotoStockListReport(): Promise<void> {
    await this.page.goto('/home/reports/stock-list/StockLists', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await expect(this.page).toHaveURL(/\/home\/reports\/stock-list\/StockLists\/?$/);
    await this.dismissOptionalPrompt();
  }

  async exportStockListCsv(): Promise<Download> {
    await expect(this.exportCsvButton).toBeVisible();
    await expect(this.exportCsvButton).toBeEnabled();

    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportCsvButton.click(),
    ]);

    return download;
  }
}

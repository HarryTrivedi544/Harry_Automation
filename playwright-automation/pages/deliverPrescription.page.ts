import { expect, type Locator, type Page } from '@playwright/test';

type StockCodes = {
  stockCode: string;
  pickupCode: string;
};

const stepDelayMs = 2_000;
const saveCompletionDelayMs = 3_000;

export class DeliverPrescriptionPage {
  readonly page: Page;
  readonly notNowButton: Locator;
  readonly deliverPrescriptionLink: Locator;
  readonly menuButton: Locator;
  readonly rxScanInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.notNowButton = page.getByRole('button', { name: 'NOT NOW' });
    this.deliverPrescriptionLink = page.locator('a[href="/home/prescription/assign"]', { hasText: 'Deliver Prescription' });
    this.menuButton = page.getByTestId('MenuIcon');
    this.rxScanInput = page.getByLabel('Scan RX Now');
    this.saveButton = page.getByRole('button', { name: 'SAVE', exact: true });
  }

  async dismissOptionalPrompt(): Promise<void> {
    const prompt = this.page.getByText('Do you want to enable consultation?', { exact: true });

    if (await prompt.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(this.notNowButton).toBeVisible();
      await this.notNowButton.click();
      await expect(prompt).toBeHidden({ timeout: 10_000 });
    }
  }

  async gotoDeliverPrescription(): Promise<void> {
    await this.dismissOptionalPrompt();
    await this.pauseBetweenSteps();
    await expect(this.deliverPrescriptionLink).toBeVisible();
    await this.deliverPrescriptionLink.click();
    await this.pauseBetweenSteps();
    await expect(this.page).toHaveURL(/\/home\/prescription\/assign\/?/);
    await expect(this.rxScanInput).toBeVisible();
  }

  async scanPrescription(rxNumbers: string[]): Promise<string> {
    await expect(this.menuButton).toBeVisible();
    await this.menuButton.click();
    await this.pauseBetweenSteps();
    await expect(this.rxScanInput).toBeEditable();

    for (const rxNumber of rxNumbers) {
      await this.rxScanInput.fill(rxNumber);
      await this.pauseBetweenSteps();

      if (await this.didScanTrigger(rxNumber)) {
        return rxNumber;
      }

      await this.rxScanInput.fill('');
      await this.pauseBetweenSteps();
    }

    throw new Error(`None of the RX values triggered the prescription API: ${rxNumbers.join(', ')}.`);
  }

  async assignBin(binLocation: string): Promise<StockCodes> {
    const bin = this.page.locator(`xpath=//div[@id='${binLocation.replace(/\s+/g, '')}']`);

    await expect(bin).toBeVisible();
    await bin.scrollIntoViewIfNeeded();
    await this.pauseBetweenSteps();
    await bin.click({ force: true });
    await this.pauseBetweenSteps();

    await expect(this.page.locator('td', { hasText: 'Stock Code:' })).toBeVisible();
    await expect(this.page.locator('td', { hasText: 'P/U Code:' })).toBeVisible();

    return {
      stockCode: await this.readCode('Stock Code:'),
      pickupCode: await this.readCode('P/U Code:'),
    };
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeVisible();
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.scrollIntoViewIfNeeded();
    await this.pauseBetweenSteps();
    await this.saveButton.click();
    await this.page.waitForTimeout(saveCompletionDelayMs);
  }

  private async readCode(label: string): Promise<string> {
    const cell = this.page.locator('td', { hasText: label });

    await expect.poll(
      async () => this.extractCodeText(cell, label),
      {
        message: `Expected ${label} value to be generated after bin assignment.`,
        timeout: 15_000,
      },
    ).not.toHaveLength(0);

    return this.extractCodeText(cell, label);
  }

  private async extractCodeText(cell: Locator, label: string): Promise<string> {
    return (await cell.textContent())?.replace(label, '').trim() ?? '';
  }

  private async didScanTrigger(rxNumber: string): Promise<boolean> {
    const prescriptionCell = this.page.getByRole('cell', { name: rxNumber, exact: true });

    if (await prescriptionCell.isVisible({ timeout: 1_000 }).catch(() => false)) {
      return true;
    }

    return (await this.rxScanInput.inputValue()) === '';
  }

  private async pauseBetweenSteps(): Promise<void> {
    await this.page.waitForTimeout(stepDelayMs);
  }
}

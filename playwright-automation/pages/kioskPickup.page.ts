import { expect, type Locator, type Page } from '@playwright/test';

const kioskActionDelayMs = 5_000;

export class KioskPickupPage {
  readonly page: Page;
  readonly pickupCodeInput: Locator;
  readonly pinOneKey: Locator;
  readonly pinTwoKey: Locator;
  readonly pinZeroKey: Locator;
  readonly confirmButton: Locator;
  readonly signatureCanvas: Locator;
  readonly nextButton: Locator;
  readonly pickUpButton: Locator;
  readonly excellentRating: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pickupCodeInput = page.locator('xpath=//div[2]/input');
    this.pinOneKey = page.locator('xpath=//div[4]/div/div/div[1]/div[1]');
    this.pinTwoKey = page.locator('xpath=//div[4]/div/div/div[1]/div[2]');
    this.pinZeroKey = page.locator('xpath=//div[4]/div[2]');
    this.confirmButton = page.getByRole('button', { name: 'Confirm', exact: true });
    this.signatureCanvas = page.locator('xpath=//div[5]/canvas');
    this.nextButton = page.getByRole('button', { name: 'Next', exact: true });
    this.pickUpButton = page.getByRole('button', { name: 'Pick Up', exact: true });
    this.excellentRating = page.locator("xpath=//img[@alt='Excellent']");
  }

  async startPickup(): Promise<void> {
    await expect(this.page).toHaveURL(/\/kiosk\/home\/?/, { timeout: 30_000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  async enterPickupCode(pickupCode: string): Promise<void> {
    await this.pastePickupCodeFromClipboard(pickupCode);
    await expect(this.pinOneKey).toBeVisible({ timeout: 30_000 });
  }

  private async pastePickupCodeFromClipboard(pickupCode: string): Promise<void> {
    await this.page.bringToFront();

    await this.page.evaluate(async (value) => {
      await navigator.clipboard.writeText(value);
    }, pickupCode.toUpperCase());

    await expect
      .poll(
        () =>
          this.page.evaluate(async () => {
            return navigator.clipboard.readText();
          }),
        { timeout: 5_000 },
      )
      .toBe(pickupCode.toUpperCase());

    await this.page.waitForTimeout(500);
    await this.page.keyboard.down('Control');
    await this.page.keyboard.press('KeyV');
    await this.page.keyboard.up('Control');
    await this.page.waitForTimeout(1_000);
  }

  private async clearPickupCodeIfVisible(): Promise<void> {
    const clearButton = this.page.getByText('Clear', { exact: true });

    if (await clearButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await clearButton.click({ force: true });
    } else if (await this.pickupCodeInput.isEditable({ timeout: 1_000 }).catch(() => false)) {
      await this.pickupCodeInput.click();
      await this.page.keyboard.press('Control+A');
      await this.page.keyboard.press('Backspace');
    }

    await this.page.waitForTimeout(500);
  }

  async enterPin(pin: string): Promise<void> {
    await this.clearPinIfVisible();

    const keyMap: Record<string, Locator> = {
      '0': this.pinZeroKey,
      '1': this.pinOneKey,
      '2': this.pinTwoKey,
    };

    for (const digit of pin) {
      const key = keyMap[digit];

      if (!key) {
        throw new Error(`Unsupported kiosk PIN digit "${digit}". Add the keypad locator before using this PIN.`);
      }

      await expect(key).toBeVisible({ timeout: 30_000 });
      await key.click({ force: true });
    }
  }

  private async clearPinIfVisible(): Promise<void> {
    const clearKey = this.page.getByText('C', { exact: true });

    if (await clearKey.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await clearKey.click({ force: true });
      await this.page.waitForTimeout(500);
    }
  }

  async confirmIdentity(): Promise<void> {
    await expect(this.confirmButton).toBeEnabled({ timeout: 30_000 });
    await this.confirmButton.click();
    await expect(this.signatureCanvas).toBeVisible({ timeout: 30_000 });
  }

  async signPickup(): Promise<void> {
    const box = await this.signatureCanvas.boundingBox();

    if (!box) {
      throw new Error('Unable to draw signature because the signature canvas is not visible.');
    }

    const startX = box.x + box.width * 0.18;
    const y = box.y + box.height * 0.55;
    const endX = box.x + box.width * 0.82;

    await this.page.mouse.move(startX, y);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width * 0.42, y - 8, { steps: 8 });
    await this.page.mouse.move(box.x + box.width * 0.62, y + 6, { steps: 8 });
    await this.page.mouse.move(endX, y, { steps: 8 });
    await this.page.mouse.up();
  }

  async completePickup(): Promise<void> {
    await expect(this.nextButton).toBeEnabled({ timeout: 30_000 });
    await this.nextButton.click();
    await expect(this.pickUpButton).toBeEnabled({ timeout: 30_000 });
    await this.pickUpButton.click();
    await expect(this.excellentRating).toBeVisible({ timeout: 30_000 });
    await this.excellentRating.click({ force: true });
    await this.page.waitForTimeout(kioskActionDelayMs);
  }
}

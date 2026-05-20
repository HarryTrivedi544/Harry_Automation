import { expect, type CDPSession, type Locator, type Page } from '@playwright/test';

type KioskCredentials = {
  username: string;
  password: string;
};

type KioskDimensions = {
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
};

const kioskActionDelayMs = 5_000;
const kioskSavePollDelayMs = 2_000;
const kioskViewport = { width: 1080, height: 1920 };

export class KioskAdminPage {
  readonly page: Page;
  readonly startImage: Locator;
  readonly adminLoginImage: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly usernamePasswordButton: Locator;
  readonly signInButton: Locator;
  readonly updatePreferencesAction: Locator;
  readonly kioskBoxIdInput: Locator;
  readonly saveButton: Locator;
  readonly backButton: Locator;
  readonly exitAction: Locator;
  private debugOverlaySession?: CDPSession;

  constructor(page: Page) {
    this.page = page;
    this.startImage = page.locator("xpath=//img[@alt='Image 1']");
    this.adminLoginImage = page.locator("xpath=//img[@title='Admin Login']");
    this.emailInput = page.locator("xpath=//input[@name='email']");
    this.passwordInput = page.locator("xpath=//input[@name='password']");
    this.usernamePasswordButton = page.getByRole('button', { name: 'Username/Password' });
    this.signInButton = page.getByRole('button', { name: 'Sign In', exact: true });
    this.updatePreferencesAction = page.locator('xpath=//div[5]/div/div/p[2]');
    this.kioskBoxIdInput = page.locator("xpath=//input[@id='kioskBoxId']");
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.backButton = page.getByRole('button', { name: 'Back', exact: true });
    this.exitAction = page.locator('xpath=//div[6]/div/div/p[1]');
  }

  async goto(url: string): Promise<void> {
    await this.grantKioskPermissions(url);
    await this.setKioskDeviceMetrics();
    await this.installProgressIndicatorHider();
    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await this.disableKioskDebugOverlays();
    await this.hideProgressIndicator();
    await this.assertKioskDimensions();
  }

  async getKioskDimensions(): Promise<KioskDimensions> {
    return this.readKioskDimensions();
  }

  async openAdminLogin(): Promise<void> {
    await this.hideProgressIndicator();
    await expect(this.startImage).toBeVisible();
    await this.startImage.click({ force: true });
    await this.hideProgressIndicator();
    await expect(this.adminLoginImage).toBeVisible();
    await this.adminLoginImage.click();
    await this.hideProgressIndicator();
  }

  async signIn(credentials: KioskCredentials): Promise<void> {
    await expect(this.usernamePasswordButton).toBeVisible();
    await this.usernamePasswordButton.click();
    await expect(this.emailInput).toBeVisible();
    await this.emailInput.fill(credentials.username);
    await expect(this.passwordInput).toBeVisible();
    await this.passwordInput.fill(credentials.password);
    await expect(this.signInButton).toBeEnabled();
    await this.signInButton.click();
    await this.waitForKioskUi();
  }

  async openPreferenceUpdate(): Promise<void> {
    await expect(this.updatePreferencesAction).toBeVisible();
    await this.updatePreferencesAction.click();
    await this.waitForKioskUi();
  }

  async saveKioskBoxId(kioskBoxId: string): Promise<void> {
    await expect(this.kioskBoxIdInput).toBeEditable();
    await this.hideProgressIndicator();
    await this.kioskBoxIdInput.fill(kioskBoxId);
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await this.page.waitForTimeout(kioskSavePollDelayMs);
    await this.hideProgressIndicator();
    await expect(this.saveButton).toBeEnabled({ timeout: 30_000 });
  }

  async goBack(): Promise<void> {
    await this.hideProgressIndicator();
    await expect(this.backButton).toBeVisible();
    await this.backButton.click();
  }

  async exitAdminMenu(): Promise<void> {
    await expect(this.exitAction).toBeVisible();
    await this.exitAction.click();
    await this.waitForKioskUi();
  }

  private async waitForKioskUi(): Promise<void> {
    await this.disableKioskDebugOverlays();
    await this.page.waitForTimeout(kioskActionDelayMs);
    await this.disableKioskDebugOverlays();
    await this.hideProgressIndicator();
  }

  private async grantKioskPermissions(url: string): Promise<void> {
    const origin = new URL(url).origin;

    await this.page.context().grantPermissions(
      [
        'camera',
        'microphone',
        'geolocation',
        'notifications',
        'clipboard-read',
        'clipboard-write',
        'local-network-access',
      ],
      { origin },
    );
  }

  private async setKioskDeviceMetrics(): Promise<void> {
    await this.page.setViewportSize(kioskViewport);

    this.debugOverlaySession = await this.page.context().newCDPSession(this.page);

    await this.debugOverlaySession.send('Emulation.setDeviceMetricsOverride', {
      width: kioskViewport.width,
      height: kioskViewport.height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: kioskViewport.width,
      screenHeight: kioskViewport.height,
      scale: 1,
    });

    await this.disableKioskDebugOverlays();
  }

  private async disableKioskDebugOverlays(): Promise<void> {
    if (!this.debugOverlaySession) {
      return;
    }

    await Promise.all([
      this.debugOverlaySession.send('Overlay.setShowFPSCounter', { show: false }).catch(() => undefined),
      this.debugOverlaySession.send('Overlay.setShowPaintRects', { result: false }).catch(() => undefined),
      this.debugOverlaySession.send('Overlay.setShowDebugBorders', { show: false }).catch(() => undefined),
      this.debugOverlaySession.send('Overlay.setShowScrollBottleneckRects', { show: false }).catch(() => undefined),
      this.debugOverlaySession.send('Overlay.setShowLayoutShiftRegions', { result: false }).catch(() => undefined),
      this.debugOverlaySession.send('Overlay.setShowViewportSizeOnResize', { show: false }).catch(() => undefined),
    ]);
  }

  private async assertKioskDimensions(): Promise<void> {
    const dimensions = await this.readKioskDimensions();

    expect(dimensions.innerWidth).toBe(kioskViewport.width);
    expect(dimensions.innerHeight).toBe(kioskViewport.height);
    expect(dimensions.screenWidth).toBe(kioskViewport.width);
    expect(dimensions.screenHeight).toBe(kioskViewport.height);
    expect(dimensions.devicePixelRatio).toBeCloseTo(1, 5);
  }

  private async installProgressIndicatorHider(): Promise<void> {
    await this.page.addInitScript(() => {
      const greenRgbPattern = /rgba?\(\s*(?:0|[1-9]\d?)\s*,\s*(?:1[2-9]\d|2[0-5]\d)\s*,\s*(?:0|[1-9]\d?)\s*(?:,|\))/;

      const removeKioskDebugOverlay = () => {
        if (!document.body) {
          return;
        }

        for (const element of Array.from(document.body.querySelectorAll('*'))) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          const text = element.textContent ?? '';
          const tagName = element.tagName.toLowerCase();
          const isVisible = rect.width > 0 && rect.height > 0;
          const isTopRightOverlay = rect.top <= 260 && rect.right >= window.innerWidth - 80 && rect.left >= window.innerWidth * 0.55;
          const isProgressSized = rect.width >= 160 && rect.width <= 420 && rect.height >= 100 && rect.height <= 260;
          const isOverlayPositioned = ['absolute', 'fixed', 'sticky'].includes(computedStyle.position) || Number(computedStyle.zIndex) > 0;
          const looksLikeTimer = /\d+:\d{2}:\d{2}/.test(text);
          const looksLikeGreenPanel =
            greenRgbPattern.test(computedStyle.backgroundColor) ||
            greenRgbPattern.test(computedStyle.color) ||
            greenRgbPattern.test(computedStyle.borderColor) ||
            greenRgbPattern.test(computedStyle.outlineColor);
          const isCanvasLikeDebugPanel = tagName === 'canvas' || tagName === 'svg';
          const hasCanvasLikeDebugChild = Boolean(element.querySelector('canvas, svg'));

          if (isVisible && isTopRightOverlay && isProgressSized && (looksLikeTimer || looksLikeGreenPanel || isCanvasLikeDebugPanel || hasCanvasLikeDebugChild || isOverlayPositioned)) {
            element.setAttribute('data-playwright-hidden-progress-indicator', 'true');
            (element as HTMLElement).style.setProperty('display', 'none', 'important');
            (element as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
            (element as HTMLElement).style.setProperty('opacity', '0', 'important');
            element.remove();
          }
        }
      };

      const style = document.createElement('style');
      style.textContent = `
        [data-playwright-hidden-progress-indicator="true"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
      document.documentElement.appendChild(style);

      const hideKioskProgressIndicator = () => {
        removeKioskDebugOverlay();
      };

      window.setInterval(hideKioskProgressIndicator, 100);
      window.addEventListener('load', hideKioskProgressIndicator);
      new MutationObserver(hideKioskProgressIndicator).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    });
  }

  private async hideProgressIndicator(): Promise<void> {
    for (const frame of this.page.frames()) {
      await frame.evaluate(() => {
        const greenRgbPattern = /rgba?\(\s*(?:0|[1-9]\d?)\s*,\s*(?:1[2-9]\d|2[0-5]\d)\s*,\s*(?:0|[1-9]\d?)\s*(?:,|\))/;

        for (const element of Array.from(document.body.querySelectorAll('*'))) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          const text = element.textContent ?? '';
          const tagName = element.tagName.toLowerCase();
          const isVisible = rect.width > 0 && rect.height > 0;
          const isTopRightOverlay = rect.top <= 260 && rect.right >= window.innerWidth - 80 && rect.left >= window.innerWidth * 0.55;
          const isProgressSized = rect.width >= 160 && rect.width <= 420 && rect.height >= 100 && rect.height <= 260;
          const isOverlayPositioned = ['absolute', 'fixed', 'sticky'].includes(computedStyle.position) || Number(computedStyle.zIndex) > 0;
          const looksLikeTimer = /\d+:\d{2}:\d{2}/.test(text);
          const looksLikeGreenPanel =
            greenRgbPattern.test(computedStyle.backgroundColor) ||
            greenRgbPattern.test(computedStyle.color) ||
            greenRgbPattern.test(computedStyle.borderColor) ||
            greenRgbPattern.test(computedStyle.outlineColor);
          const isCanvasLikeDebugPanel = tagName === 'canvas' || tagName === 'svg';
          const hasCanvasLikeDebugChild = Boolean(element.querySelector('canvas, svg'));

          if (isVisible && isTopRightOverlay && isProgressSized && (looksLikeTimer || looksLikeGreenPanel || isCanvasLikeDebugPanel || hasCanvasLikeDebugChild || isOverlayPositioned)) {
            element.setAttribute('data-playwright-hidden-progress-indicator', 'true');
            (element as HTMLElement).style.setProperty('display', 'none', 'important');
            (element as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
            (element as HTMLElement).style.setProperty('opacity', '0', 'important');
            element.remove();
          }
        }
      });
    }
  }

  private async readKioskDimensions(): Promise<KioskDimensions> {
    return this.page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio,
    }));
  }
}

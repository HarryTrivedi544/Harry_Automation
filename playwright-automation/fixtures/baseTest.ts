/// <reference types="node" />
import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

type Fixtures = {
  loginPage: LoginPage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);

    // Grant camera and microphone permissions to avoid manual prompt
    await page.context().grantPermissions(['camera', 'microphone']);

    // Apply 75% zoom on every new page
    await page.context().addInitScript(() => {
      const applyZoom = () => {
        if (document.body) document.body.style.zoom = '0.75';
        else setTimeout(applyZoom, 10);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyZoom);
      } else {
        applyZoom();
      }
    });

    // Go to login page
    await loginPage.goto();

    // Perform login
    await loginPage.login(
      process.env.ADMIN_USERNAME!,
      process.env.ADMIN_PASSWORD!
    );

    // Wait for successful navigation (adjust if needed)
    await page.waitForLoadState('networkidle');

    await use(loginPage);
  },
});

export { expect };

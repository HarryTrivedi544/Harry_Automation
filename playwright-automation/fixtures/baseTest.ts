/// <reference types="node" />
import { test as base, expect } from '@playwright/test';
import { loadTestData, type TestData } from '../config/testData';
import { defaultTestSetup, resolveTestSetup, type TestSetup } from '../config/testSetups';
import type { UserRole } from '../config/users';
import { LoginPage } from '../pages/login.page';

type Fixtures = {
  loginPage: LoginPage;
  testData: TestData;
};

type Options = {
  testSetup: TestSetup;
  userRole?: UserRole;
  credentialProfile?: string;
};

export const test = base.extend<Fixtures & Options>({
  testSetup: [defaultTestSetup, { option: true }],
  userRole: [undefined, { option: true }],
  credentialProfile: [undefined, { option: true }],

  testData: async ({ testSetup, userRole, credentialProfile }, use) => {
    await use(loadTestData({
      ...testSetup,
      userRole: userRole ?? testSetup.userRole,
      credentialProfile: credentialProfile ?? testSetup.credentialProfile,
    }));
  },

  loginPage: async ({ page, testSetup, userRole, credentialProfile }, use) => {
    const loginPage = new LoginPage(page);
    const resolvedSetup = resolveTestSetup({
      ...testSetup,
      userRole: userRole ?? testSetup.userRole,
      credentialProfile: credentialProfile ?? testSetup.credentialProfile,
    });

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
    await loginPage.goto(resolvedSetup.baseUrl);

    // Perform login
    await loginPage.login(resolvedSetup.user.username, resolvedSetup.user.password);

    // Wait for successful navigation (adjust if needed)
    await page.waitForLoadState('networkidle');

    await use(loginPage);
  },
});

export { expect };

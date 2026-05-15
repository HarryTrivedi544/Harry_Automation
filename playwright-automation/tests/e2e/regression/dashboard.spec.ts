/// <reference types="node" />
import { test, expect } from '../../../fixtures/baseTest';

test.describe.configure({ timeout: 120_000 });

test('User lands on home after login', async ({ page, loginPage }) => {
  await expect(page).toHaveURL(/\/home\/?/);
});

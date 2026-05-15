import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('#new-username');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.getByText('SIGN IN', { exact: true });
  }

  async goto() {
    await this.page.goto('/', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await this.page.waitForTimeout(30_000);
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForURL(/\/home\/?/, { timeout: 15_000 });
  }
}

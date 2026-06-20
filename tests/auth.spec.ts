import { test, expect, TEST_ACCOUNTS, loginAsUser } from "./helpers";

test.describe("Authentication & Login", () => {
  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/auth/login");

    // Fill credentials
    await page.fill('input[type="email"]', TEST_ACCOUNTS.broker.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.broker.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL("/dashboard");
    expect(page.url()).toContain("/dashboard");
  });

  test("should show error on invalid email", async ({ page }) => {
    await page.goto("/auth/login");

    // Fill invalid email
    await page.fill('input[type="email"]', "invalid@nts.example.com");
    await page.fill('input[type="password"]', TEST_ACCOUNTS.broker.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error message
    const errorMsg = page.locator("role=alert");
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test("should show error on invalid password", async ({ page }) => {
    await page.goto("/auth/login");

    // Fill with wrong password
    await page.fill('input[type="email"]', TEST_ACCOUNTS.broker.email);
    await page.fill('input[type="password"]', "WrongPassword123!");

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error message
    const errorMsg = page.locator("role=alert");
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test("should require email field", async ({ page }) => {
    await page.goto("/auth/login");

    // Try to submit without email
    await page.fill('input[type="password"]', TEST_ACCOUNTS.broker.password);
    await page.click('button[type="submit"]');

    // Email field should have error or required indicator
    const emailInput = page.locator('input[type="email"]');
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid,
    );
    expect(isInvalid).toBeTruthy();
  });

  test("should require password field", async ({ page }) => {
    await page.goto("/auth/login");

    // Try to submit without password
    await page.fill('input[type="email"]', TEST_ACCOUNTS.broker.email);
    await page.click('button[type="submit"]');

    // Password field should have error or required indicator
    const passwordInput = page.locator('input[type="password"]');
    const isInvalid = await passwordInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid,
    );
    expect(isInvalid).toBeTruthy();
  });

  test("should allow navigation to signup page", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("link", { name: /create an account/i }).click();
    await page.waitForURL(/\/auth\/signup/);
    expect(page.url()).toContain("/auth/signup");
  });
});

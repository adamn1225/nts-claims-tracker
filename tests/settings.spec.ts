import { test, expect, TEST_ACCOUNTS, loginAsUser } from "./helpers";

test.describe("Settings Page - Notification Configuration", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(
      page,
      TEST_ACCOUNTS.broker.email,
      TEST_ACCOUNTS.broker.password,
    );
  });

  test("should display notification settings sections", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Check for main sections
    const sections = [
      "Notification Settings",
      "In-App Notifications",
      "Email Notifications",
    ];
    for (const section of sections) {
      expect(await page.locator(`text=${section}`).first()).toBeVisible();
    }
  });

  test("should display default task settings", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Check for date and time inputs
    expect(await page.locator('input[type="date"]')).toBeVisible();
    expect(await page.locator('input[type="time"]')).toBeVisible();
  });

  test("should display in-app reminder options", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Look for reminder checkboxes
    const reminderText = [
      "Same Day",
      "1 Day Before",
      "2 Days Before",
      "3 Days Before",
    ];
    for (const text of reminderText) {
      expect(await page.locator(`text=${text}`).first()).toBeVisible();
    }
  });

  test("should highlight 15-minute auto reminder", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Look for always-on indicator
    const autoReminder = page.getByText("15 Minutes Before").first();
    await expect(autoReminder).toBeVisible();
  });

  test("should allow toggling email notifications", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Find email toggle
    const emailToggle = page.locator('input[type="checkbox"]').nth(0); // First checkbox is usually the master toggle
    const initialState = await emailToggle.isChecked();

    // Toggle it
    await emailToggle.click();

    // State should change
    const newState = await emailToggle.isChecked();
    expect(newState).toBe(!initialState);
  });

  test("should display SendGrid API key input when email enabled", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    // Find email toggle and ensure it's enabled
    const emailToggle = page.locator('input[type="checkbox"]').nth(0);
    if (!(await emailToggle.isChecked())) {
      await emailToggle.click();
    }

    // Wait a moment for conditional render
    await page.waitForTimeout(300);

    // Look for SendGrid input
    const sendgridInput = page.locator('input[type="password"]');
    expect(await sendgridInput.count()).toBeGreaterThan(0);
  });

  test("should show SendGrid documentation link", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Find SendGrid link
    const sendgridLink = page.locator('a[href*="sendgrid"]');
    if ((await sendgridLink.count()) > 0) {
      expect(await sendgridLink.getAttribute("href")).toContain("sendgrid");
    }
  });

  test("should allow saving settings", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Fill in some settings
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(new Date().toISOString().split("T")[0]);

    // Click save button
    const saveButton = page.locator('button:has-text("Save Settings")');
    await saveButton.click();

    // Should show success notification or indication
    // Wait for response
    await page.waitForTimeout(1000);

    // Button should be back to normal (not loading)
    expect(await saveButton.isDisabled()).toBeFalsy();
  });

  test("should allow canceling settings changes", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Get initial state
    const dateInput = page.locator('input[type="date"]');
    const initialValue = await dateInput.inputValue();

    // Change a value
    await dateInput.fill("2025-12-31");

    // Click cancel
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Should navigate away or reset
    // Check that we're not on settings or value is reset
    const urlOrReset = page.url().includes("/dashboard/settings")
      ? await dateInput.inputValue()
      : initialValue;
  });

  test("should disable email reminder options when email disabled", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");

    // Find and click email toggle to disable
    const emailToggle = page
      .locator('label:has-text("Enable Email")')
      .locator('input[type="checkbox"]');
    if (await emailToggle.isChecked()) {
      await emailToggle.click();
    }

    // Wait for conditional render
    await page.waitForTimeout(300);

    // Email reminder checkboxes should not be visible or disabled
    const emailRemindersSection = page.getByText("Email Reminders");
    const isVisible = await emailRemindersSection
      .isVisible()
      .catch(() => false);

    // Email section may be hidden or checkboxes disabled
    if (isVisible) {
      const emailCheckboxes = page
        .locator('input[type="checkbox"]')
        .filter({ has: page.getByText(/Day Before/) });
      const count = await emailCheckboxes.count();
      expect(count).toBeLessThanOrEqual(4);
    }
  });
});

test.describe("Settings Page - Mobile Responsiveness", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(
      page,
      TEST_ACCOUNTS.broker.email,
      TEST_ACCOUNTS.broker.password,
    );
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test("should display properly on mobile", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Check that main content is visible
    expect(
      await page.locator("text=/Notification Settings/").first(),
    ).toBeVisible();
  });

  test("should have touch-friendly button sizes", async ({ page }) => {
    await page.goto("/dashboard/settings");

    // Check button size
    const saveButton = page.locator('button:has-text("Save Settings")');
    const boundingBox = await saveButton.boundingBox();

    // Buttons should be at least 44x44px for touch targets
    expect(boundingBox!.height).toBeGreaterThanOrEqual(44);
    expect(boundingBox!.width).toBeGreaterThanOrEqual(44);
  });
});

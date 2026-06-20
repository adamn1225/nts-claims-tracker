/**
 * Test utilities and fixtures for NTS Claims Tracker QA
 * Shared helpers for authentication, navigation, and data setup
 */

import { test as base, expect, Page } from "@playwright/test";

export const test = base.extend({
  // Add custom fixtures here if needed
});

export { expect };

/**
 * Test accounts for different roles
 */
export const TEST_ACCOUNTS = {
  broker: {
    email: "broker.test@nts.example.com",
    password: "TestBroker123!@#",
    role: "broker",
  },
  admin: {
    email: "admin.test@nts.example.com",
    password: "TestAdmin123!@#",
    role: "admin",
  },
  manager: {
    email: "manager.test@nts.example.com",
    password: "TestManager123!@#",
    role: "manager",
  },
};

/**
 * Helper function to login a user
 */
export async function loginAsUser(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation to dashboard
  await page.waitForURL("/dashboard");
}

/**
 * Helper function to logout
 */
export async function logout(page: Page) {
  // Click on user menu (typically top right)
  await page.click("[data-testid='user-menu']");
  // Click logout button
  await page.click("text=Logout");
  // Wait for redirect to login
  await page.waitForURL("/auth/login");
}

/**
 * Helper to create a test customer
 */
export async function createTestCustomer(page: Page, customerData: any = {}) {
  const defaults = {
    business_name: "Test Customer " + Math.random().toString(36).substr(2, 9),
    contact_name: "John Doe",
    phone: "555-0100",
    email: "contact@testcustomer.com",
    shipping_frequency: "weekly",
  };

  const data = { ...defaults, ...customerData };

  // Navigate to customers page
  await page.goto("/dashboard/customers");

  // Click create new customer button
  await page.click("button:has-text('New Customer')");

  // Fill form
  await page.fill('input[name="business_name"]', data.business_name);
  await page.fill('input[name="contact_name"]', data.contact_name);
  await page.fill('input[name="phone"]', data.phone);
  await page.fill('input[name="email"]', data.email);
  await page.selectOption(
    'select[name="shipping_frequency"]',
    data.shipping_frequency,
  );

  // Submit
  await page.click('button:has-text("Create Customer")');
  await page.waitForURL("/dashboard/customers");

  return data;
}

/**
 * Helper to create a test task
 */
export async function createTestTask(page: Page, taskData: any = {}) {
  const defaults = {
    title: "Test Task " + Math.random().toString(36).substr(2, 9),
    type: "call",
    priority: "medium",
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    reminder_days: ["0", "1"],
  };

  const data = { ...defaults, ...taskData };

  // Navigate to tasks page
  await page.goto("/dashboard/tasks");

  // Click create new task button
  await page.click("button:has-text('New Task')");

  // Fill form
  await page.fill('input[name="title"]', data.title);
  await page.selectOption('select[name="type"]', data.type);
  await page.selectOption('select[name="priority"]', data.priority);
  await page.fill('input[name="due_date"]', data.due_date);

  // Set reminders
  for (const reminder of data.reminder_days) {
    await page.check(`input[value="${reminder}"]`);
  }

  // Submit
  await page.click('button:has-text("Create Task")');
  await page.waitForURL("/dashboard/tasks");

  return data;
}

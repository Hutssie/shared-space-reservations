import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('E1: Register new user and land on dashboard', async ({ page }) => {
    await page.goto('/auth/register');
    const unique = Date.now();
    await page.getByPlaceholder(/john doe/i).fill('E2E User');
    await page.getByPlaceholder(/hello@example\.com/i).fill(`e2e-${unique}@example.com`);
    await page.getByPlaceholder(/••••••••/i).fill('password123');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/E2E User|dashboard|my bookings/i).first()).toBeVisible();
  });

  test('E2: Login with seed guest user', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder(/hello@example\.com/i).fill('guest@example.com');
    await page.getByPlaceholder(/••••••••/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|$)/);
    await expect(page.locator('a[href="/find"]').first()).toBeVisible();
  });

  test('E3: Wrong password shows error', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder(/hello@example\.com/i).fill('guest@example.com');
    await page.getByPlaceholder(/••••••••/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByText(/invalid|error|wrong/i)).toBeVisible();
  });

  test('E4: Protected route redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.getByPlaceholder(/hello@example\.com/i).fill('guest@example.com');
    await page.getByPlaceholder(/••••••••/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

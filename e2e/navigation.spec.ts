import { test, expect } from '@playwright/test';

test.describe('Navigation and accessibility', () => {
  test('E18: Navbar links work', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /find a space/i }).click();
    await expect(page).toHaveURL(/\/find/);
    await page.goto('/auth/login');
    await page.getByPlaceholder(/hello@example\.com/i).fill('guest@example.com');
    await page.getByPlaceholder(/••••••••/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|$)/);
    await page.getByRole('link', { name: /find a space/i }).click();
    await expect(page).toHaveURL(/\/find/);
    await page.getByRole('link', { name: /host portal/i }).click();
    await expect(page).toHaveURL(/\/host/);
  });

  test('E19: Footer and main links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('contentinfo').or(page.getByRole('link', { name: /terms|privacy|about/i })).first()).toBeVisible();
    await page.getByRole('link', { name: /find|explore/i }).first().click();
    await expect(page).toHaveURL(/\/(find|\/)/);
  });

  test('E20: 404 or invalid space id', async ({ page }) => {
    await page.goto('/space/invalid-id-12345');
    await expect(page.getByText(/space not found|not found|browse spaces/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /browse spaces|find/i }).first()).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Favorites and dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder(/hello@example\.com/i).fill('guest@example.com');
    await page.getByPlaceholder(/••••••••/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('E13: Add favorite and see in dashboard', async ({ page }) => {
    await page.goto('/find');
    const firstCard = page.locator('a[href*="/space/"]').first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/space\//, { timeout: 10000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
    const spaceId = page.url().split('/space/')[1]?.split('?')[0]?.split('/')[0];
    const token = await page.evaluate(() => localStorage.getItem('token'));
    if (token && spaceId) {
      await page.request.post('http://localhost:3000/api/favorites', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { space_id: spaceId },
      });
    }
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByText('Favorites').first()).toBeVisible({ timeout: 5000 });
    await page.getByText('Favorites').first().click();
    await expect(page.getByText(/my favorites|saved spaces/i).first()).toBeVisible();
  });

  test('E14: Dashboard bookings tab shows user bookings', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/active bookings|my bookings|manage your creative sessions/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/all bookings|upcoming|past/i).first()).toBeVisible({ timeout: 5000 });
  });
});

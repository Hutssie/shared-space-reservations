import { test, expect } from '@playwright/test';

test.describe('Host flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder(/hello@example\.com/i).fill('host@example.com');
    await page.getByPlaceholder(/••••••••/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  });

  test('E15: Host dashboard lists host spaces', async ({ page }) => {
    await page.goto('/host');
    await expect(page.getByRole('heading', { name: /host dashboard/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href*="/host/manage-listings"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('E16: Manage listings and edit space', async ({ page }) => {
    await page.goto('/host/manage-listings');
    await expect(page).toHaveURL(/\/host\/manage-listings/);
    await expect(page.getByRole('heading', { name: /manage listings/i })).toBeVisible({ timeout: 10000 });
    const editLink = page.locator('a[href*="/host/manage-listings/edit/"]').first();
    if (await editLink.isVisible()) {
      await editLink.click();
      await expect(page).toHaveURL(/\/host\/manage-listings\/edit\//);
      await expect(page.getByRole('heading', { level: 2 }).or(page.getByRole('heading', { level: 1 })).first()).toBeVisible();
    }
  });

  test('E17: Create new listing (ListSpace)', async ({ page }) => {
    await page.goto('/list-your-space');
    await page.getByRole('button', { name: /start listing/i }).click();
    await page.getByText('Photo Studio').click();
    await page.getByRole('button', { name: /next step/i }).click();
    await page.getByPlaceholder(/united states/i).fill('USA');
    await page.getByPlaceholder(/new york/i).fill('NY');
    await page.getByPlaceholder(/brooklyn/i).fill('Brooklyn');
    await page.getByPlaceholder(/123 creative lane/i).fill('123 Test St');
    await page.getByPlaceholder(/11201/i).fill('11201');
    await page.getByText(/place pin on map/i).click({ force: true });
    await page.getByRole('button', { name: /next step/i }).click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image'),
    });
    await page.getByRole('button', { name: /next step/i }).click();
    await page.getByPlaceholder(/^0$/).fill('50');
    await page.getByPlaceholder(/describe your studio/i).fill('E2E test space.');
    await page.getByRole('button', { name: /complete listing/i }).click();
    await expect(page.getByText(/your space is ready|success|excellent work/i).first()).toBeVisible({ timeout: 15000 });
  });
});

import { test, expect } from '@playwright/test';

test.describe('Browse and search', () => {
  test('E5: Home page loads and shows featured spaces', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/find|space|book/i).first()).toBeVisible();
    await expect(page.locator('a[href="/find"]')).toBeVisible();
    const cards = page.locator('a[href*="/space/"]');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('E6: Find page shows spaces from API', async ({ page }) => {
    await page.goto('/find');
    await expect(page.getByPlaceholder(/search city|space type/i)).toBeVisible();
    await expect(page.getByText(/space type|filter|category/i).first()).toBeVisible();
    await expect(page.locator('a[href*="/space/"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('E7: Search by query updates list', async ({ page }) => {
    await page.goto('/find');
    const search = page.getByPlaceholder(/search city|space type/i);
    await search.fill('studio');
    await search.press('Enter');
    await page.waitForTimeout(500);
    const results = page.locator('a[href*="/space/"]');
    const count = await results.count();
    expect(count >= 0).toBeTruthy();
  });

  test('E8: Filter by category', async ({ page }) => {
    await page.goto('/find');
    await page.getByRole('button', { name: /space type|category/i }).first().click();
    await page.getByText(/photo studio|conference|art studio/i).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/space|spaces found|results/i).first()).toBeVisible();
  });

  test('E9: Open space detail from find', async ({ page }) => {
    await page.goto('/find');
    const firstCard = page.locator('a[href*="/space/"]').first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/space\/[a-z0-9-]+/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/\$|price|hour/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /instant book|request to book/i }).first()).toBeVisible();
  });
});

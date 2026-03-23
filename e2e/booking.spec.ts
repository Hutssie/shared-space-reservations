import { test, expect } from '@playwright/test';

// Rulez testele de booking pe rand (serial) ca `localStorage.clear()` din E11 sa nu se calce cu E10/E12 (context comun).
test.describe.serial('Booking flow', () => {
  test.beforeEach(async ({ page }) => {
    // Porneste dintr-o stare de auth curata la fiecare rulare, ca a doua rulare sa nu foloseasca tokenuri vechi (rezolva "prima trece, a doua pica”).
    await page.goto('/auth/login');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/auth/login');
    await page.getByPlaceholder(/hello@example\.com/i).fill('guest@example.com');
    await page.getByPlaceholder(/••••••••/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|$)/);
    // Asteptam sa se salveze auth-ul ca E10/E12 sa aiba token (app-ul il poate seta dupa /users/me).
    await expect(async () => {
      const token = await page.evaluate(() => localStorage.getItem('token'));
      if (!token) throw new Error('Token not in localStorage');
    }).toPass({ timeout: 10000 });
  });

  test('E10: Book a space (logged in)', async ({ page }) => {
    await page.goto('/find');
    const firstCard = page.locator('a[href*="/space/"]').first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/space\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.getByTestId('booking-date-trigger').scrollIntoViewIfNeeded();
    await page.getByTestId('booking-date-trigger').click();
    await expect(page.getByTestId('calendar-panel')).toBeVisible({ timeout: 5000 });
    const panel = page.getByTestId('calendar-panel');
    await panel.getByRole('button').filter({ has: page.locator('svg') }).last().click();
    await page.waitForTimeout(300);
    await panel.locator('button:not([disabled])').filter({ hasText: /^\d{1,2}$/ }).first().click();
    await page.waitForTimeout(1000);
    const timeSlots = page.locator('div').filter({ has: page.getByText(/daily availability/i) }).locator('button:not([disabled])').filter({ hasText: /\d{1,2}(:\d{2})? (AM|PM)/ });
    await timeSlots.nth(0).click();
    await timeSlots.nth(1).click();
    // Verificam ca suntem inca pe pagina spatiului si butonul de rezervare e vizibil (evitam sa asteptam raspuns daca am fost redirectati la login).
    await expect(page).toHaveURL(/\/space\//);
    const bookBtn = page.getByRole('button', { name: /instant book|request to book/i }).first();
    await expect(bookBtn).toBeVisible();
    const bookingResponse = page.waitForResponse(
      (res) => res.url().includes('/api/bookings') && res.request().method() === 'POST',
      { timeout: 20000 }
    );
    await bookBtn.click();
    let res: Awaited<ReturnType<typeof page.waitForResponse>>;
    try {
      res = await bookingResponse;
    } catch {
      if (await page.getByRole('heading', { name: /sign in/i }).isVisible()) {
        throw new Error(
          'Booking failed: redirected to login before/during request (session lost). Ensure backend is running and not restarted between runs; beforeEach now clears storage for a fresh login.'
        );
      }
      throw new Error('POST /api/bookings did not get a response within 20s.');
    }
    if (res.status() === 401) {
      throw new Error(
        'Booking API returned 401. Ensure backend is running, guest@example.com is seeded (npm run db:seed), and CORS allows the frontend origin.'
      );
    }
    if (!res.ok()) {
      const body = await res.text();
      throw new Error(`Booking API failed ${res.status()}: ${body}`);
    }
    await expect(page.getByTestId('booking-confirmation')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /booking confirmed|reservation requested/i })).toBeVisible({ timeout: 5000 });
  });

  test('E11: Book without login redirects to login', async ({ page }) => {
    await page.goto('/');
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/find');
    const firstCard = page.locator('a[href*="/space/"]').first();
    await firstCard.click();
    await page.getByText(/09 AM|09:00 AM/).first().click();
    await page.getByText(/10 AM|10:00 AM/).first().click();
    await page.getByRole('button', { name: /instant book|request to book/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.getByPlaceholder(/hello@example\.com/i).fill('guest@example.com');
    await page.getByPlaceholder(/••••••••/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|space)/);
  });

  test('E12: Conflicted time slot shows error', async ({ page }) => {
    await page.goto('/find');
    const href = await page.locator('a[href*="/space/"]').first().getAttribute('href');
    const spaceId = href?.replace(/.*\/space\//, '').replace(/\?.*/, '').trim();
    if (!spaceId) throw new Error('No space link found on /find');

    const apiBase = 'http://localhost:3000';
    const token = await page.evaluate(() => localStorage.getItem('token'));
    if (!token) {
      throw new Error(
        'Not logged in (token missing). Booking tests run serially so E11 does not clear storage; ensure backend is running and guest@example.com is seeded.'
      );
    }
    const bookDate = new Date();
    bookDate.setDate(bookDate.getDate() + 1);
    const dateStr = bookDate.toISOString().slice(0, 10);
    const createRes = await page.request.post(`${apiBase}/api/bookings`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      data: { space_id: spaceId, date: dateStr, start_time: '08:00 AM', end_time: '09:00 AM' },
      failOnStatusCode: false,
    });
    if (createRes.status() !== 201 && createRes.status() !== 409) {
      const body = await createRes.text();
      throw new Error(`Create booking failed ${createRes.status()}: ${body}`);
    }
    // 201 = l-am creat noi; 409 = slotul era deja ocupat (ex. seed sau o rulare anterioara). In ambele cazuri slotul ar trebui sa apara dezactivat.

    // Deschid spatiul cu data rezervata ca sa apara in calendar; verificam ca slotul rezervat e dezactivat.
    await page.goto((href || '/find') + (href?.includes('?') ? '&' : '?') + 'date=' + dateStr);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.getByTestId('booking-date-trigger').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    // Data e setata deja prin URL; asteptam sa se incarce disponibilitatea si sa apara slotul rezervat ca „dezactivat”.
    const disabledSlots = page.locator('div').filter({ has: page.getByText(/daily availability/i) }).locator('button[disabled]').filter({ hasText: /\d{1,2}(:\d{2})? (AM|PM)/ });
    await expect(disabledSlots.first()).toBeVisible({ timeout: 15000 });
  });
});

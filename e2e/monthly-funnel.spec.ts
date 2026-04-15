import { test, expect } from '@playwright/test';

/**
 * Smoke coverage for the monthly-funnel feature. Empty-DB test only
 * — asserts the chrome loads and proper empty states render. Seeded
 * E2E (drill-down drawer, XLSX export) requires the seed fixture at
 * apps/api/scripts/seed-monthly-funnel.ts and is gated behind the
 * OVERNIGHT_SEED=1 env flag.
 */

test.describe('monthly funnel — unauth bounce + reports wrapper', () => {
  test('unauthenticated hit redirects to /login', async ({ page }) => {
    await page.goto('/funnels/00000000-0000-0000-0000-000000000000/monthly');
    await expect(page).toHaveURL(/\/login/);
  });

  test('reports wrapper is reachable from nav', async ({ page }) => {
    await page.goto('/reports/monthly-funnel');
    // unauth → login gate fires
    await expect(page).toHaveURL(/\/(login|reports\/monthly-funnel)/);
  });
});

test.describe('monthly funnel — authenticated (empty DB)', () => {
  test.skip(({ baseURL }) => !process.env['OVERNIGHT_E2E_EMAIL'], 'credentials not provided');

  test.beforeEach(async ({ page }) => {
    const email = process.env['OVERNIGHT_E2E_EMAIL']!;
    const password = process.env['OVERNIGHT_E2E_PASSWORD']!;
    await page.goto('/login');
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/(home|onboarding)/);
  });

  test('reports/monthly-funnel shows selector or empty state', async ({ page }) => {
    await page.goto('/reports/monthly-funnel');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeVisible();
  });
});

test.describe('monthly funnel — seeded (OVERNIGHT_SEED)', () => {
  test.skip(() => process.env['OVERNIGHT_SEED'] !== '1', 'seed fixture not loaded');

  test('pivot table renders 12 rows + sticky month column', async ({ page }) => {
    await page.goto('/reports/monthly-funnel');
    const firstFunnelLink = page.locator('a[href^="/funnels/"][href$="/monthly"]').first();
    await firstFunnelLink.click();
    await page.waitForURL(/\/funnels\/.*\/monthly/);

    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(12);

    const firstMonthCell = page.locator('table tbody tr').first().locator('td').first();
    await expect(firstMonthCell).toHaveCSS('position', 'sticky');
  });

  test('CV cell click opens drill-down drawer', async ({ page }) => {
    await page.goto('/reports/monthly-funnel');
    await page.locator('a[href^="/funnels/"][href$="/monthly"]').first().click();
    await page.waitForURL(/\/funnels\/.*\/monthly/);

    const cv1Cell = page.locator('[data-testid=stage-cell-cv1]').first();
    await cv1Cell.click();
    await expect(page.locator('[role=dialog]')).toBeVisible();
  });

  test('note cell persists after reload', async ({ page }) => {
    await page.goto('/reports/monthly-funnel');
    await page.locator('a[href^="/funnels/"][href$="/monthly"]').first().click();
    const noteCell = page.locator('[data-testid=note-cell]').first();
    await noteCell.click();
    await noteCell.fill('E2E test note');
    await noteCell.blur();
    await page.waitForTimeout(700);
    await page.reload();
    await expect(noteCell).toHaveText(/E2E test note/);
  });
});

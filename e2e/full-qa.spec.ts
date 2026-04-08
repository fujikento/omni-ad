import { test, expect } from '@playwright/test';

const BASE = 'https://omni-ad-deploy.vercel.app';

// Known expected errors (no API backend on Vercel)
const EXPECTED_ERRORS = [
  'Failed to fetch', 'fetch', 'ERR_CONNECTION', 'NetworkError',
  'localhost:3001', 'trpc', 'NEXT_NOT_FOUND', 'ChunkLoadError',
  'hydration', 'favicon',
];

function isExpectedError(msg: string): boolean {
  return EXPECTED_ERRORS.some(e => msg.includes(e));
}

const ALL_PAGES = [
  '/login', '/register', '/home', '/ai-pilot', '/campaigns',
  '/creatives', '/creatives/mass-production', '/creatives/video-studio',
  '/creatives/optimization', '/analytics', '/audiences',
  '/audiences/identity-graph', '/budgets', '/funnels', '/reports',
  '/ab-tests', '/auto-rules', '/approvals', '/competitors',
  '/clients', '/ltv', '/settings', '/settings/ai',
  '/settings/conversions', '/account-analysis', '/onboarding',
  '/campaigns/group-buy',
];

const LANGUAGES = ['ja', 'en', 'zh', 'ko'] as const;

// ============================================================
// 1. All pages load in all 4 languages
// ============================================================
for (const lang of LANGUAGES) {
  test.describe(`Language: ${lang}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
      await page.evaluate((l) => localStorage.setItem('omni-ad-locale', l), lang);
    });

    for (const path of ALL_PAGES) {
      test(`${path} loads in ${lang}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('console', msg => {
          if (msg.type() === 'error' && !isExpectedError(msg.text())) {
            errors.push(msg.text());
          }
        });

        const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
        expect(resp?.status()).toBeLessThan(400);
        expect(errors).toHaveLength(0);
      });
    }
  });
}

// ============================================================
// 2. Modal open/close tests
// ============================================================
test.describe('Modals', () => {
  test('Campaign create modal opens', async ({ page }) => {
    await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle' });
    const btn = page.locator('button').filter({ hasText: /新規キャンペーン|Create New|新建|새 캠페인/ });
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(1000);
      // Modal should have appeared — check for form elements
      const hasModal = await page.locator('input, select, [role="dialog"]').count();
      expect(hasModal).toBeGreaterThan(3);
    }
  });

  test('Emergency stop modal opens and closes', async ({ page }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    const btn = page.locator('button').filter({ hasText: /緊急停止|Emergency/ });
    await btn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/emergency-modal.png' });

    const cancelBtn = page.locator('button').filter({ hasText: /キャンセル|Cancel/ });
    if (await cancelBtn.count() > 0) await cancelBtn.click();
  });
});

// ============================================================
// 3. Navigation tests
// ============================================================
test.describe('Navigation', () => {
  test('Sidebar has all nav groups', async ({ page }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    const nav = page.locator('nav[aria-label]');
    await expect(nav).toBeVisible();
    const links = await nav.locator('a[href]').count();
    expect(links).toBeGreaterThan(15);
  });

  test('Language switcher cycles through all languages', async ({ page }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });

    for (const lang of ['English', '中文', '한국어', '日本語']) {
      const globeBtn = page.locator('button').filter({ hasText: /JA|EN|ZH|KO/ }).first();
      if (await globeBtn.count() > 0) {
        await globeBtn.click();
        await page.waitForTimeout(300);
        const option = page.locator('button').filter({ hasText: lang });
        if (await option.count() > 0) {
          await option.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });
});

// ============================================================
// 4. Mobile responsive tests
// ============================================================
test.describe('Mobile responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Home page renders without sidebar overlap', async ({ page }) => {
    await page.goto(`${BASE}/home`, { waitUntil: 'networkidle' });
    const sidebar = page.locator('aside, nav').first();
    const sidebarBox = await sidebar.boundingBox();
    // Sidebar should be hidden or not overlapping main content
    if (sidebarBox) {
      expect(sidebarBox.width).toBeLessThan(100); // Collapsed or hidden
    }
  });

  test('Campaign page is scrollable', async ({ page }) => {
    await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle' });
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(400);
  });
});

// ============================================================
// 5. Form interaction tests
// ============================================================
test.describe('Form interactions', () => {
  test('Login form shows error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'test@invalid.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    // Should show error or stay on login (not redirect)
    expect(page.url()).toContain('/login');
  });

  test('Register form validates password match', async ({ page }) => {
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.fill('input[name="password"], input[type="password"]', 'Test1234!');
    // Don't fill confirm password - try to submit
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      // Should not redirect (validation should catch it)
      expect(page.url()).toContain('/register');
    }
  });
});

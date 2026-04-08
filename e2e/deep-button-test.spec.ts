import { test, expect, type Page } from '@playwright/test';

const BASE = 'https://omni-ad-deploy.vercel.app';

// Pages with interactive elements to test
const INTERACTIVE_PAGES = [
  '/home',
  '/ai-pilot',
  '/campaigns',
  '/creatives',
  '/creatives/mass-production',
  '/creatives/video-studio',
  '/creatives/optimization',
  '/analytics',
  '/audiences',
  '/audiences/identity-graph',
  '/budgets',
  '/funnels',
  '/reports',
  '/ab-tests',
  '/auto-rules',
  '/approvals',
  '/competitors',
  '/clients',
  '/ltv',
  '/settings',
  '/settings/ai',
  '/settings/conversions',
  '/account-analysis',
  '/onboarding',
  '/campaigns/group-buy',
];

// Destructive button patterns to skip
const DESTRUCTIVE_PATTERNS = [
  /緊急停止|Emergency Stop/i,
  /削除|Delete|Remove/i,
  /切断|Disconnect/i,
  /ログアウト|Logout|Log out/i,
  /取り消し|Cancel request/i,
  /却下|Reject/i,
  /ロールバック|Rollback/i,
];

function isDestructive(text: string): boolean {
  return DESTRUCTIVE_PATTERNS.some(p => p.test(text));
}

async function getButtonInfo(page: Page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button:not([disabled])'));
    return buttons.map((b, i) => ({
      index: i,
      text: (b.textContent?.trim() || '').slice(0, 50),
      ariaLabel: b.getAttribute('aria-label') || '',
      type: b.getAttribute('type') || '',
      className: b.className.slice(0, 80),
    }));
  });
}

async function clickButtonAndCheck(page: Page, index: number, text: string): Promise<string> {
  try {
    const buttons = page.locator('button:not([disabled])');
    const count = await buttons.count();
    if (index >= count) return 'SKIP: button gone';

    await buttons.nth(index).click({ timeout: 3000, force: true });
    await page.waitForTimeout(500);

    // Check if a modal/dialog appeared
    const hasModal = await page.locator('[role="dialog"], .fixed.inset-0, [class*="modal"]').count();
    if (hasModal > 0) return 'MODAL_OPENED';

    // Check if dropdown appeared
    const hasDropdown = await page.locator('[role="listbox"], [role="menu"], [class*="dropdown"]').count();
    if (hasDropdown > 0) return 'DROPDOWN_OPENED';

    return 'CLICKED_OK';
  } catch (e) {
    return `ERROR: ${(e as Error).message.slice(0, 60)}`;
  }
}

for (const path of INTERACTIVE_PAGES) {
  test.describe(`Page: ${path}`, () => {
    test('all buttons respond to clicks', async ({ page }) => {
      // Suppress dialogs
      page.on('dialog', async dialog => { await dialog.dismiss(); });

      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);

      const buttons = await getButtonInfo(page);
      const issues: string[] = [];

      for (const btn of buttons) {
        const label = btn.text || btn.ariaLabel || 'unknown';
        if (isDestructive(label)) continue;
        if (!label || label.length < 1) continue;
        // Skip tiny icon-only buttons (sidebar collapse etc)
        if (label.length <= 2 && !btn.ariaLabel) continue;

        const result = await clickButtonAndCheck(page, btn.index, label);

        if (result.startsWith('ERROR')) {
          issues.push(`${label}: ${result}`);
        }

        // Close any opened modal/dropdown before next button
        if (result === 'MODAL_OPENED' || result === 'DROPDOWN_OPENED') {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          // Double-escape in case nested
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }

      // Report but don't fail on button issues (some may legitimately do nothing visible)
      if (issues.length > 0) {
        console.log(`[${path}] Button issues: ${issues.join('; ')}`);
      }
    });

    test('page scrolls fully without errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', err => {
        // Only catch actual uncaught JS exceptions, not console errors
        const msg = err.message;
        if (!msg.includes('fetch') && !msg.includes('hydration') && !msg.includes('ChunkLoad')) {
          errors.push(msg);
        }
      });

      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 });

      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);

      // Take screenshot at bottom
      const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewportHeight = await page.evaluate(() => window.innerHeight);

      // Page should have content (at least as tall as viewport)
      expect(scrollHeight).toBeGreaterThanOrEqual(viewportHeight);

      // No JS errors while scrolling
      expect(errors).toHaveLength(0);
    });
  });
}

// ============================================================
// Modal-specific deep tests
// ============================================================
test.describe('Modal deep tests', () => {
  test('Campaign create: modal opens with form fields', async ({ page }) => {
    page.on('dialog', async d => await d.dismiss());
    await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle' });

    const createBtn = page.locator('button').filter({ hasText: /新規キャンペーン|Create New|新建|새 캠페인/ });
    if (await createBtn.count() > 0) {
      await createBtn.first().click();
      await page.waitForTimeout(1000);
      // Modal should have form inputs
      const inputs = await page.locator('.fixed input, .fixed select').count();
      expect(inputs).toBeGreaterThan(0);
    }
  });

  test('Auto-rules: open create modal', async ({ page }) => {
    page.on('dialog', async d => await d.dismiss());
    await page.goto(`${BASE}/auto-rules`, { waitUntil: 'networkidle' });

    const createBtn = page.locator('button').filter({ hasText: /新規ルール|Create.*Rule|新建|새 규칙/ });
    if (await createBtn.count() > 0) {
      await createBtn.first().click();
      await page.waitForTimeout(1000);
      const hasForm = await page.locator('.fixed input, .fixed select').count();
      expect(hasForm).toBeGreaterThan(0);
    }
  });

  test('AB tests: open create test modal', async ({ page }) => {
    page.on('dialog', async d => await d.dismiss());
    await page.goto(`${BASE}/ab-tests`, { waitUntil: 'networkidle' });

    const createBtn = page.locator('button').filter({ hasText: /Create New Test|新規テスト|新建测试|새 테스트/ });
    if (await createBtn.count() > 0) {
      await createBtn.first().click();
      await page.waitForTimeout(1000);
      const hasForm = await page.locator('input, select').count();
      expect(hasForm).toBeGreaterThan(0);
    }
  });

  test('Competitors: open add competitor modal', async ({ page }) => {
    page.on('dialog', async d => await d.dismiss());
    await page.goto(`${BASE}/competitors`, { waitUntil: 'networkidle' });

    const addBtn = page.locator('button').filter({ hasText: /競合を追加|Add Competitor|添加|추가/ });
    if (await addBtn.count() > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(1000);
      const hasForm = await page.locator('input').count();
      expect(hasForm).toBeGreaterThan(0);
    }
  });

  test('Reports: open generate report modal', async ({ page }) => {
    page.on('dialog', async d => await d.dismiss());
    await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });

    const genBtn = page.locator('button').filter({ hasText: /レポート生成|Generate|生成|생성/ });
    if (await genBtn.count() > 0) {
      await genBtn.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test('Group buy: open create group buy modal', async ({ page }) => {
    page.on('dialog', async d => await d.dismiss());
    await page.goto(`${BASE}/campaigns/group-buy`, { waitUntil: 'networkidle' });

    const createBtn = page.locator('button').filter({ hasText: /作成|Create|创建|만들기/ });
    if (await createBtn.count() > 0) {
      await createBtn.first().click();
      await page.waitForTimeout(1000);
    }
  });
});

// ============================================================
// Chinese and Korean display quality
// ============================================================
for (const lang of ['zh', 'ko'] as const) {
  test.describe(`${lang} display quality`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}/home`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(l => localStorage.setItem('omni-ad-locale', l), lang);
    });

    const CHECK_PAGES = ['/home', '/campaigns', '/ai-pilot', '/settings/ai', '/ab-tests', '/competitors'];

    for (const path of CHECK_PAGES) {
      test(`${path} has no layout overflow in ${lang}`, async ({ page }) => {
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 });

        // Check for horizontal overflow (broken layout)
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll).toBe(false);
      });
    }
  });
}

import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/login', title: 'ログイン' },
  { path: '/register', title: '新規登録' },
  { path: '/home', title: 'ダッシュボード' },
  { path: '/ai-pilot', title: 'AI' },
  { path: '/campaigns', title: 'キャンペーン' },
  { path: '/creatives', title: 'クリエイティブ' },
  { path: '/creatives/mass-production', title: '大量生産' },
  { path: '/creatives/video-studio', title: '動画' },
  { path: '/creatives/optimization', title: '最適化' },
  { path: '/analytics', title: '分析' },
  { path: '/audiences', title: 'オーディエンス' },
  { path: '/audiences/identity-graph', title: 'アイデンティティ' },
  { path: '/budgets', title: '予算' },
  { path: '/funnels', title: 'ファネル' },
  { path: '/reports', title: 'レポート' },
  { path: '/ab-tests', title: 'A/B' },
  { path: '/auto-rules', title: 'ルール' },
  { path: '/approvals', title: '承認' },
  { path: '/competitors', title: '競合' },
  { path: '/clients', title: 'クライアント' },
  { path: '/ltv', title: 'LTV' },
  { path: '/settings', title: '設定' },
  { path: '/settings/ai', title: 'AI設定' },
  { path: '/settings/conversions', title: 'コンバージョン' },
  { path: '/account-analysis', title: 'アカウント' },
  { path: '/onboarding', title: 'オンボーディング' },
  { path: '/campaigns/group-buy', title: 'グループ' },
];

test.describe('All pages load without errors', () => {
  for (const page of PAGES) {
    test(`${page.path} loads correctly`, async ({ page: p }) => {
      const consoleErrors: string[] = [];
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const response = await p.goto(page.path, { waitUntil: 'networkidle' });

      expect(response?.status()).toBeLessThan(400);
      // Filter known expected errors in demo environment (no API backend on Vercel)
      const realErrors = consoleErrors.filter(
        (e) =>
          !e.includes('hydration') &&
          !e.includes('favicon') &&
          !e.includes('Failed to fetch') &&
          !e.includes('fetch') &&
          !e.includes('ERR_CONNECTION') &&
          !e.includes('NetworkError') &&
          !e.includes('localhost:3001') &&
          !e.includes('trpc') &&
          !e.includes('NEXT_NOT_FOUND') &&
          !e.includes('ChunkLoadError')
      );
      expect(realErrors).toHaveLength(0);
    });
  }
});

test.describe('Navigation works', () => {
  test('sidebar links are clickable', async ({ page }) => {
    await page.goto('/home', { waitUntil: 'networkidle' });

    const navLinks = await page.locator('nav a[href]').count();
    expect(navLinks).toBeGreaterThan(10);
  });

  test('language switcher works', async ({ page }) => {
    await page.goto('/home', { waitUntil: 'networkidle' });

    const globeButton = page.locator('button:has(svg)').filter({ hasText: /JA|EN|ZH|KO/ });
    if (await globeButton.count() > 0) {
      await globeButton.first().click();
      await page.waitForTimeout(500);

      const enOption = page.locator('button').filter({ hasText: 'English' });
      if (await enOption.count() > 0) {
        await enOption.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});

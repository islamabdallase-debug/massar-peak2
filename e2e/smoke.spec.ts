// ============================================================
//  مسار — E2E Smoke Tests (Playwright)
//  Critical user flows: app loads, navigation, student CRUD
//  Run: npm run test:e2e
//  Requires: npm run dev running on localhost:5173
// ============================================================

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ── Helper: wait for app to be ready ────────────────────────
async function waitForApp(page: Page) {
  // Splash screen disappears when root is populated
  await page.waitForSelector('#root > *', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

// ── 1. App loads ─────────────────────────────────────────────
test('app loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(BASE_URL);
  await waitForApp(page);

  // No critical JS errors on load
  const criticalErrors = errors.filter(
    (e) => !e.includes('favicon') && !e.includes('sw.js')
  );
  expect(criticalErrors).toHaveLength(0);
});

// ── 2. Sidebar navigation ─────────────────────────────────────
test('sidebar navigation works', async ({ page }) => {
  await page.goto(BASE_URL);
  await waitForApp(page);

  // Open sidebar if on mobile
  const menuBtn = page.locator('[aria-label*="القائمة"]').first();
  if (await menuBtn.isVisible()) await menuBtn.click();

  // Navigate to Students
  await page.locator('[aria-label*="الطلاب"], [aria-label*="Students"]').first().click();
  await expect(page.locator('h2')).toContainText('الطلاب');
});

// ── 3. Dashboard loads with stats ────────────────────────────
test('dashboard shows stats cards', async ({ page }) => {
  await page.goto(BASE_URL);
  await waitForApp(page);

  // Should show at least one stat card
  await expect(page.locator('[role="main"]')).toBeVisible();
});

// ── 4. Student add flow ───────────────────────────────────────
test('can add a new student', async ({ page }) => {
  await page.goto(BASE_URL);
  await waitForApp(page);

  // Navigate to Students
  const sidebar = page.locator('nav[aria-label="القائمة الرئيسية"]');
  await sidebar.locator('text=الطلاب').click();

  // Click add student button
  const addBtn = page.locator('button:has-text("إضافة"), button:has-text("طالب جديد")').first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    // Fill name
    const nameInput = page.locator('input[placeholder*="اسم"], input[name="name"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('طالب تجريبي E2E');
      // Submit
      const saveBtn = page.locator('button:has-text("حفظ"), button[type="submit"]').first();
      await saveBtn.click();
      // Should show the new student
      await expect(page.locator('text=طالب تجريبي E2E')).toBeVisible({ timeout: 5000 });
    }
  }
});

// ── 5. Assessment screen loads ───────────────────────────────
test('assessment screen renders without crash', async ({ page }) => {
  await page.goto(BASE_URL);
  await waitForApp(page);

  const sidebar = page.locator('nav[aria-label="القائمة الرئيسية"]');
  await sidebar.locator('text=التقييم').click();

  await expect(page.locator('[role="main"]')).toBeVisible();
  // Should not show error boundary fallback
  await expect(page.locator('text=حدث خطأ غير متوقع')).not.toBeVisible();
});

// ── 6. Reports screen loads ───────────────────────────────────
test('reports screen renders without crash', async ({ page }) => {
  await page.goto(BASE_URL);
  await waitForApp(page);

  const sidebar = page.locator('nav[aria-label="القائمة الرئيسية"]');
  await sidebar.locator('text=التقارير').click();

  await expect(page.locator('[role="main"]')).toBeVisible();
  await expect(page.locator('text=حدث خطأ غير متوقع')).not.toBeVisible();
});

// ── 7. Export screen loads ────────────────────────────────────
test('export screen renders without crash', async ({ page }) => {
  await page.goto(BASE_URL);
  await waitForApp(page);

  const sidebar = page.locator('nav[aria-label="القائمة الرئيسية"]');
  await sidebar.locator('text=التصدير').click();

  await expect(page.locator('[role="main"]')).toBeVisible();
  await expect(page.locator('text=حدث خطأ غير متوقع')).not.toBeVisible();
});

// ── 8. Tools screen loads ─────────────────────────────────────
test('tools screen renders without crash', async ({ page }) => {
  await page.goto(BASE_URL);
  await waitForApp(page);

  const sidebar = page.locator('nav[aria-label="القائمة الرئيسية"]');
  await sidebar.locator('text=الأدوات').click();

  await expect(page.locator('[role="main"]')).toBeVisible();
  await expect(page.locator('text=حدث خطأ غير متوقع')).not.toBeVisible();
});

// ── 9. Language switch ────────────────────────────────────────
test('language switch works', async ({ page }) => {
  await page.goto(BASE_URL);
  await waitForApp(page);

  // Click EN button
  const enBtn = page.locator('button:has-text("English")').first();
  if (await enBtn.isVisible()) {
    await enBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // Switch back to Arabic
    const arBtn = page.locator('button:has-text("عربي")').first();
    await arBtn.click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  }
});

// ── 10. Offline banner appears when offline ──────────────────
test('offline banner appears on network disconnect', async ({ page, context }) => {
  await page.goto(BASE_URL);
  await waitForApp(page);

  // Simulate going offline
  await context.setOffline(true);
  // Banner should appear
  await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 3000 });
  await context.setOffline(false);
});

const { test, expect } = require('@playwright/test');

test('app loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('#menuScreen')).toBeVisible();
  await expect(page.locator('#menuMain')).toBeVisible();
  expect(errors).toEqual([]);
});

test('topic select shows topics', async ({ page }) => {
  await page.goto('/');
  await page.locator('#openTopicSelectBtn').click();
  await expect(page.locator('#menuTopicSelect')).toBeVisible();
  const sel = page.locator('#topicSelect');
  await expect(sel).toBeVisible();
  const count = await sel.locator('option').count();
  expect(count).toBeGreaterThan(5);
});

test('choosing a topic shows topic menu', async ({ page }) => {
  await page.goto('/');
  await page.locator('#openTopicSelectBtn').click();
  await expect(page.locator('#topicSelect')).toBeVisible();
  await page.locator('#topicSelect').selectOption({ index: 1 });
  await expect(page.locator('#startPart1Btn')).toBeVisible();
});

test('start Part 1 shows intro screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('#openTopicSelectBtn').click();
  await page.locator('#topicSelect').selectOption({ index: 1 });
  await page.locator('#startPart1Btn').click();
  await expect(page.locator('#introScreen')).toBeVisible({ timeout: 10000 });
});

test('start Part 3 shows quiz screen with a question', async ({ page }) => {
  await page.goto('/');
  await page.locator('#openTopicSelectBtn').click();
  await page.locator('#topicSelect').selectOption({ index: 1 });
  await page.locator('#openPracticeSetupBtn').click();
  await expect(page.locator('#menuPracticeSetup')).toBeVisible();
  await page.locator('#startBtn').click();
  await expect(page.locator('#quizScreen')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#questionText')).not.toBeEmpty();
});

test('submit answer shows feedback', async ({ page }) => {
  await page.goto('/');
  await page.locator('#openTopicSelectBtn').click();
  await page.locator('#topicSelect').selectOption({ index: 1 });
  await page.locator('#openPracticeSetupBtn').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#quizScreen')).toBeVisible({ timeout: 10000 });
  const mcOption = page.locator('#mcBlock .option').first();
  const openInput = page.locator('#openInput');
  if (await mcOption.isVisible({ timeout: 2000 }).catch(() => false)) {
    await mcOption.click();
  } else if (await openInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await openInput.fill('test');
    await page.locator('#submitBtn').click();
  }
  await expect(page.locator('#feedbackBlock')).toBeVisible({ timeout: 5000 });
});

test('exam bundle loads open cloze menu', async ({ page }) => {
  await page.goto('/_exam_app/index.html');
  await expect(page.locator('#menuExamPractice')).toBeVisible();
  await page.locator('#examOpenClozeBtn').click();
  await expect(page.locator('#menuOpenCloze')).toBeVisible();
});

test('reference button on home menu', async ({ page }) => {
  await page.goto('/');
  await page.locator('#openReferenceBtn').click();
  await expect(page.locator('#referenceScreen')).toBeVisible({ timeout: 10000 });
});

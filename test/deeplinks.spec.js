/**
 * E2E coverage for #practice/... deep links (see data/tree/how_teacher_links_will_work.md).
 * Run: npm run test:e2e
 */
const { test, expect } = require('@playwright/test');
const { trackErrors } = require('./e2e-helpers');

test('#practice/root/<root> shows the landing panel and opens an entry point', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/#practice/root/verb_phrase', { waitUntil: 'networkidle' });

  await expect(page.locator('#menuRootPractice')).toBeVisible();
  await expect(page.locator('#rootPracticeTitle')).toHaveText('Verb Phrase');
  await expect(page.locator('#rootPracticeDesc')).not.toBeEmpty();
  const btnCount = await page.locator('#rootPracticeEntryPoints button').count();
  expect(btnCount).toBeGreaterThan(0);

  // Clicking an entry point lands on topic select, preselected, with a shareable hash
  await page.locator('#rootPracticeEntryPoints button', { hasText: 'Modal Verbs' }).first().click();
  await expect(page.locator('#menuTopicSelect')).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe('#topic/modal_verbs');
  const selText = await page.evaluate(() => {
    const sel = document.getElementById('topicSelect');
    return sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '';
  });
  expect(selText).toMatch(/Modal Verbs/i);

  expect(errors).toEqual([]);
});

test('#practice/root_id resolves family keys, granular ids and CEFR-stem fallbacks', async ({ page }) => {
  const errors = trackErrors(page);
  const cases = [
    // [hash, expected title pattern, resolution path]
    ['#practice/root_id/present_perfect', /Present Perfect/, 'exact family key'],
    ['#practice/root_id/B2.modals.speculation_past', /Modal/, 'granular id listed in data'],
    ['#practice/root_id/B1.modals.speculation_past', /Modal/, 'CEFR-stem parse (id not in data)'],
    ['#practice/root_id/A2.relative_clauses.basic', /Relative/, 'granular search (stem is not a family key)'],
  ];
  for (const [hash, pattern, path] of cases) {
    await page.goto('/' + hash, { waitUntil: 'networkidle' });
    await expect(page.locator('#menuRootPractice'), hash + ' via ' + path).toBeVisible();
    await expect(page.locator('#rootPracticeTitle'), hash + ' via ' + path).toHaveText(pattern);
  }
  expect(errors).toEqual([]);
});

test('#practice/topic/<id> behaves like the legacy #topic/<id> route', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/#practice/topic/present_perfect', { waitUntil: 'networkidle' });
  await expect(page.locator('#menuTopicSelect')).toBeVisible();

  await page.goto('/#topic/articles', { waitUntil: 'networkidle' });
  await expect(page.locator('#menuTopicSelect')).toBeVisible();

  expect(errors).toEqual([]);
});

test('unknown practice links fail soft to the main menu with a notice', async ({ page }) => {
  const errors = trackErrors(page);
  for (const hash of ['#practice/root/bogus', '#practice/root_id/Z9.nope.nope', '#practice/garbage']) {
    await page.goto('/' + hash, { waitUntil: 'networkidle' });
    await expect(page.locator('#menuMain'), hash).toBeVisible();
    await expect(page.locator('#deepLinkNotice'), hash).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('live hashchange routes without a reload, and in-app Back returns home', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#menuMain')).toBeVisible();

  await page.evaluate(() => { location.hash = '#practice/root/noun_phrase'; });
  await expect(page.locator('#menuRootPractice')).toBeVisible();
  await expect(page.locator('#rootPracticeTitle')).toHaveText(/Noun Phrase/);

  await page.click('#rootPracticeBackBtn');
  await expect(page.locator('#menuMain')).toBeVisible();

  expect(errors).toEqual([]);
});

test('app degrades gracefully when root_content_index.json fails to load', async ({ page }) => {
  await page.route('**/root_content_index.json*', r => r.abort());
  await page.goto('/#practice/root/verb_phrase', { waitUntil: 'networkidle' });
  await expect(page.locator('#menuMain')).toBeVisible();
  await expect(page.locator('#deepLinkNotice')).toBeVisible();
});

/**
 * E2E: progress portability — export/import progress as a JSON file.
 * Run: npm run test:e2e  (auto-starts node server.js on port 5555)
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { trackErrors } = require('./e2e-helpers');

// Mirror of questionHash in js/storage.js (key = hash of question text).
function questionHash(q) {
  const s = (q.question || q.prompt || '').trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return (h >>> 0).toString(36);
}

const pool = Object.values(require('../questions.json').modal_verbs || {}).flatMap(s => s.questions || []);
const DAY_MS = 24 * 60 * 60 * 1000;
const past = new Date(Date.now() - 2 * DAY_MS).toISOString();

function progressFile(data) {
  return {
    name: 'rue2-progress-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'rue2-progress', version: 1, exported: new Date().toISOString(), data })),
  };
}

const sampleData = () => ({
  grammarQuizScores: { history: [{ set_id: 'modal_verbs', set_title: 'Modal Verbs', score: 9, total: 10, date: past }] },
  grammarQuizMemory: {
    [questionHash(pool[0])]: { wrong: 1, right: 0, lastWrong: past, box: 0, due: past, last: past },
  },
  reportedQuestions: [],
  rue2_theme: null,
});

test('export downloads a versioned snapshot of the four state keys', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('#menuMain')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportProgressLink').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^rue2-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const env = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(env.format).toBe('rue2-progress');
  expect(env.version).toBe(1);
  for (const key of ['grammarQuizScores', 'grammarQuizMemory', 'reportedQuestions']) {
    expect(env.data).toHaveProperty(key);
  }
  expect(errors).toEqual([]);
});

test('import into a fresh profile surfaces stats and the review button', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#menuMain')).toBeVisible();
  await expect(page.locator('#reviewDueBtn')).toBeHidden();
  await page.locator('#importProgressInput').setInputFiles(progressFile(sampleData()));
  await expect(page.locator('#progressPortabilityNote')).toHaveText('Imported: 1 quiz result, 1 tracked question.');
  await expect(page.locator('#reviewDueBtn')).toBeVisible();        // overdue item became today's review
  await expect(page.locator('#memoryBankSummary')).toContainText('1 quiz completed');
});

test('importing the same file twice is idempotent', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#menuMain')).toBeVisible();
  await page.locator('#importProgressInput').setInputFiles(progressFile(sampleData()));
  await expect(page.locator('#progressPortabilityNote')).toHaveText('Imported: 1 quiz result, 1 tracked question.');
  await page.locator('#importProgressInput').setInputFiles(progressFile(sampleData()));
  await expect(page.locator('#progressPortabilityNote'))
    .toHaveText('Imported: 1 quiz result, 1 tracked question (everything was already on this device).');
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('grammarQuizScores')).history);
  expect(history).toHaveLength(1);
});

test('malformed files fail soft with a message and leave state untouched', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#menuMain')).toBeVisible();
  await page.locator('#importProgressInput').setInputFiles({
    name: 'junk.json', mimeType: 'application/json', buffer: Buffer.from('{not json'),
  });
  await expect(page.locator('#progressPortabilityNote')).toContainText('Import failed: that file is not valid JSON.');
  await page.locator('#importProgressInput').setInputFiles({
    name: 'wrong.json', mimeType: 'application/json', buffer: Buffer.from('{"some":"other file"}'),
  });
  await expect(page.locator('#progressPortabilityNote')).toContainText('Import failed: this is not a RUE2 progress file.');
  expect(await page.evaluate(() => localStorage.getItem('grammarQuizScores'))).toBeNull();
});

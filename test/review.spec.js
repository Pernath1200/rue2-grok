/**
 * E2E: spaced repetition — "Today's review" scheduling and surfacing.
 * Run: npm run test:e2e  (auto-starts node server.js on port 5555)
 *
 * Seeds the memory bank (localStorage, keyed by question-text hash) before
 * the app loads, so tests control what is due without clock mocking.
 */
const { test, expect } = require('@playwright/test');
const { trackErrors, answerThroughQuizCorrectly } = require('./e2e-helpers');

// Mirror of questionHash in js/storage.js (key = hash of question text).
function questionHash(q) {
  const s = (q.question || q.prompt || '').trim();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return (h >>> 0).toString(36);
}

const POOL_KEY = 'modal_verbs';
const pool = Object.values(require('../questions.json')[POOL_KEY] || {}).flatMap(s => s.questions || []);

const DAY_MS = 24 * 60 * 60 * 1000;
const past = new Date(Date.now() - 2 * DAY_MS).toISOString();
const future = new Date(Date.now() + 10 * DAY_MS).toISOString();

async function seedBank(page, bank) {
  await page.addInitScript(b => localStorage.setItem('grammarQuizMemory', b), JSON.stringify(bank));
}

const readBank = page => page.evaluate(() => JSON.parse(localStorage.getItem('grammarQuizMemory') || '{}'));

test('fresh student sees no review button', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('#menuMain')).toBeVisible();
  await expect(page.locator('#reviewDueBtn')).toBeHidden();
  expect(errors).toEqual([]);
});

test('due and legacy-wrong items are counted; future items are not', async ({ page }) => {
  const [qA, qB, qC] = pool;
  await seedBank(page, {
    [questionHash(qA)]: { wrong: 1, right: 0, lastWrong: past, box: 0, due: past },   // overdue
    [questionHash(qB)]: { wrong: 2, right: 1, lastWrong: past },                      // legacy, ever-wrong → due now
    [questionHash(qC)]: { wrong: 1, right: 3, lastWrong: past, box: 3, due: future }, // not due yet
  });
  await page.goto('/');
  await expect(page.locator('#reviewDueBtn')).toBeVisible();
  await expect(page.locator('#reviewDueBtn')).toHaveText("Today's review: 2 items");
});

test('review session: correct answers climb a box and push due into the future', async ({ page }) => {
  const [qA, qB, qC] = pool;
  const kA = questionHash(qA), kB = questionHash(qB), kC = questionHash(qC);
  await seedBank(page, {
    [kA]: { wrong: 1, right: 0, lastWrong: past, box: 0, due: past },
    [kB]: { wrong: 2, right: 1, lastWrong: past },
    [kC]: { wrong: 1, right: 3, lastWrong: past, box: 3, due: future },
  });
  await page.goto('/');
  await page.locator('#reviewDueBtn').click();
  await expect(page.locator('#quizScreen')).toBeVisible();
  expect(await answerThroughQuizCorrectly(page, POOL_KEY)).toBe('result');

  const bank = await readBank(page);
  for (const k of [kA, kB]) {
    expect(bank[k].box).toBe(1);                                  // 0 → 1 after a right answer
    expect(new Date(bank[k].due).getTime()).toBeGreaterThan(Date.now());
  }
  expect(bank[kC].box).toBe(3);                                   // not due → untouched
  expect(bank[kC].due).toBe(future);

  // Back home: nothing due any more, button gone
  await page.locator('#backToMenuBtn').click();
  await expect(page.locator('#menuMain')).toBeVisible();
  await expect(page.locator('#reviewDueBtn')).toBeHidden();
});

test('legacy never-wrong entries migrate to the long track, staggered into the future', async ({ page }) => {
  const q = pool[0];
  const k = questionHash(q);
  await seedBank(page, { [k]: { wrong: 0, right: 4, lastWrong: null } });
  await page.goto('/');
  await expect(page.locator('#menuMain')).toBeVisible();
  // The migration happens during async startup (first getDueReviews call), so
  // poll for it rather than racing it — the button is hidden in the markup
  // from the start, so its state alone proves nothing about readiness.
  await expect.poll(async () => (await readBank(page))[k]?.box).toBe(4);  // 21-day track
  await expect(page.locator('#reviewDueBtn')).toBeHidden();       // staggered due is in the future
  const bank = await readBank(page);
  const dueIn = new Date(bank[k].due).getTime() - Date.now();
  expect(dueIn).toBeGreaterThan(0);
  expect(dueIn).toBeLessThanOrEqual(21 * DAY_MS + 1000);          // within the 3-week stagger window
});

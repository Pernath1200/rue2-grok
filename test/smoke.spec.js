/**
 * E2E smoke suite: quick visibility checks + the core student journeys.
 * Run: npm run test:e2e  (auto-starts node server.js on port 5555)
 *
 * Each test gets a fresh browser context (clean localStorage), so journeys
 * always start from a brand-new student profile.
 */
const { test, expect } = require('@playwright/test');
const { trackErrors, selectTopic, answerThroughQuiz, answerThroughQuizCorrectly, getFamilyNode, getTapProgress } = require('./e2e-helpers');

// ── Quick checks ────────────────────────────────────────────────────────────

test('app loads without console errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('#menuScreen')).toBeVisible();
  await expect(page.locator('#menuMain')).toBeVisible();
  await expect(page.locator('#openDiagnosticSetupBtn')).toBeVisible();
  await expect(page.locator('#showTreeBtn')).toBeVisible();
  expect(errors).toEqual([]);
});

test('topic select shows topics', async ({ page }) => {
  await page.goto('/');
  await page.locator('#openTopicSelectBtn').click();
  await expect(page.locator('#menuTopicSelect')).toBeVisible();
  const sel = page.locator('#topicSelect');
  await expect(sel).toBeVisible();
  // Placeholder + all menu topics (29 at time of writing; assert a sane floor)
  const count = await sel.locator('option').count();
  expect(count).toBeGreaterThan(20);
});

test('choosing a topic shows topic menu', async ({ page }) => {
  await page.goto('/');
  await page.locator('#openTopicSelectBtn').click();
  await expect(page.locator('#topicSelect')).toBeVisible();
  await page.locator('#topicSelect').selectOption({ index: 1 });
  await expect(page.locator('#startPart1Btn')).toBeVisible();
});

test('category filter shows each topic under its correct category', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.click('#openTopicSelectBtn');
  await expect(page.locator('#menuTopicSelect')).toBeVisible();

  const visibleTopics = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('#topicSelect option'))
      .filter(o => !o.hidden && o.value !== '-1')
      .map(o => o.textContent.trim()));

  // Word Order belongs to Sentence Structure (root: tap_root)
  await page.selectOption('#categorySelect', 'sentence_structure');
  let visible = await visibleTopics();
  expect(visible.join(' | ')).toMatch(/Word Order/i);

  // Extras must not contain ghosts: Word Formation is menu-excluded and
  // Word Order belongs to Sentence Structure
  await page.selectOption('#categorySelect', 'extras');
  visible = await visibleTopics();
  expect(visible.join(' | ')).toMatch(/Spelling/i);
  expect(visible.join(' | ')).not.toMatch(/Word Order|Word Formation/i);
});

test('shows an honest error when topics.json fails to load (no stale fallback)', async ({ page }) => {
  await page.route('**/topics.json*', r => r.abort());
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#menuMain')).toBeVisible();
  await expect(page.locator('#deepLinkNotice')).toContainText('Could not load the topic list');
  // No fallback list: the topic dropdown stays empty rather than showing stale data
  expect(await page.locator('#topicSelect option').count()).toBe(0);
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

// ── Core student journeys ───────────────────────────────────────────────────

test('journey: complete a lesson section (Part 1: intro + check quiz)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  await selectTopic(page, 'Modal Verbs');
  await page.click('#startPart1Btn');
  await expect(page.locator('#introScreen')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#introTitle')).not.toBeEmpty();
  await expect(page.locator('#introContent')).not.toBeEmpty();

  // Advance through intro sections; the last one's button reads "Start test"
  let startedCheck = false;
  for (let i = 0; i < 40; i++) {
    const label = (await page.locator('#introNextBtn').textContent()).trim();
    await page.click('#introNextBtn');
    if (label === 'Start test') { startedCheck = true; break; }
    if (label === 'Menu') break; // topic without check questions — intro alone completes Part 1
  }
  expect(startedCheck, 'expected the intro to end in a short check quiz').toBe(true);

  await expect(page.locator('#quizScreen')).toBeVisible();
  const ending = await answerThroughQuiz(page);
  expect(ending).toBe('sectionComplete');
  await expect(page.locator('#sectionCompleteTitle')).toHaveText('Part 1 complete');
  await expect(page.locator('#sectionCompleteScore')).toContainText(/Score: \d+ \/ \d+/);

  expect(errors).toEqual([]);
});

test('journey: take a practice quiz and see results', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  await selectTopic(page, 'Modal Verbs');
  await page.click('#openPracticeSetupBtn');
  await expect(page.locator('#menuPracticeSetup')).toBeVisible();
  await page.selectOption('#numQuestionsSelect', '10');
  await page.click('#startBtn');

  await expect(page.locator('#quizScreen')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#questionText')).not.toBeEmpty();

  const ending = await answerThroughQuiz(page, 12);
  expect(ending).toBe('result');
  await expect(page.locator('#resultScore')).toContainText(/Score: \d+ \/ 10/);

  // Back to the main menu cleanly
  await page.click('#backToMenuBtn');
  await expect(page.locator('#menuMain')).toBeVisible();

  expect(errors).toEqual([]);
});

test('journey: tree reflects progress after a completed quiz', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  // Baseline: fresh profile, zero practice volume
  const before = await getTapProgress(page);
  expect(before).toBe(0);

  // Complete a 10-question quiz (saves a score + memory bank entries)
  await selectTopic(page, 'Modal Verbs');
  await page.click('#openPracticeSetupBtn');
  await page.selectOption('#numQuestionsSelect', '10');
  await page.click('#startBtn');
  await expect(page.locator('#quizScreen')).toBeVisible({ timeout: 10000 });
  await answerThroughQuiz(page, 12);
  await page.click('#backToMenuBtn');
  await expect(page.locator('#menuMain')).toBeVisible();

  // The tap root grows once the student has real history (10 answers → ~0.22)
  const after = await getTapProgress(page);
  expect(after).toBeGreaterThan(before + 0.15);

  expect(errors).toEqual([]);
});

test('journey: tree mastery is honest — 0% when fresh, 100% after a perfect quiz', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  // Fresh profile: the tree must claim no mastery
  const before = await getFamilyNode(page, 'Modal Verbs');
  expect(before.title).toContain('mastery 0%');

  // Perfect 10-question quiz on Modal Verbs (answers from questions.json)
  await selectTopic(page, 'Modal Verbs');
  await page.click('#openPracticeSetupBtn');
  await page.selectOption('#numQuestionsSelect', '10');
  await page.click('#startBtn');
  await expect(page.locator('#quizScreen')).toBeVisible({ timeout: 10000 });
  const ending = await answerThroughQuizCorrectly(page, 'modal_verbs');
  expect(ending).toBe('result');
  await expect(page.locator('#resultScore')).toContainText('Score: 10 / 10');
  await page.click('#backToMenuBtn');

  // The family node now reports full mastery, and grew visibly
  const after = await getFamilyNode(page, 'Modal Verbs');
  expect(after.title).toContain('mastery 100%');
  expect(after.r).toBeGreaterThan(before.r + 3);

  expect(errors).toEqual([]);
});

test('journey: weak areas practice works after mistakes exist', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  // Build memory-bank history first (dummy answers guarantee some wrong)
  await selectTopic(page, 'Modal Verbs');
  await page.click('#openPracticeSetupBtn');
  await page.selectOption('#numQuestionsSelect', '10');
  await page.click('#startBtn');
  await expect(page.locator('#quizScreen')).toBeVisible({ timeout: 10000 });
  await answerThroughQuiz(page, 12);
  await page.click('#backToMenuBtn');

  await page.click('#practiceWeakBtn');
  await expect(page.locator('#quizScreen')).toBeVisible();
  await expect(page.locator('#questionText')).not.toBeEmpty();

  expect(errors).toEqual([]);
});

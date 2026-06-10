/* Throwaway verification for #practice/... deep links. Run: node verify_deeplinks.js */
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:5555/';
let failures = 0;
function check(label, ok, extra) {
  if (ok) { console.log('  PASS: ' + label); }
  else { failures++; console.error('  FAIL: ' + label + (extra ? ' — ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const consoleErrors = [];

  async function freshPage(hash) {
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(hash + ': ' + m.text()); });
    page.on('pageerror', e => consoleErrors.push(hash + ': ' + e.message));
    await page.goto(BASE + hash, { waitUntil: 'networkidle' });
    return page;
  }

  // 1. Root deep link — landing panel
  let page = await freshPage('#practice/root/verb_phrase');
  let visible = await page.isVisible('#menuRootPractice');
  let title = await page.textContent('#rootPracticeTitle');
  let btnCount = await page.locator('#rootPracticeEntryPoints button').count();
  check('#practice/root/verb_phrase shows panel', visible);
  check('  title is "Verb Phrase"', title === 'Verb Phrase', 'got "' + title + '"');
  check('  has entry-point buttons', btnCount > 0, 'count=' + btnCount);

  // 2. Click an entry point → topic select preselected + hash updated
  await page.locator('#rootPracticeEntryPoints button', { hasText: 'Modal Verbs' }).first().click();
  await page.waitForTimeout(300);
  check('  click "Modal Verbs" → topic select panel', await page.isVisible('#menuTopicSelect'));
  check('  URL hash is #topic/modal_verbs', (await page.evaluate(() => location.hash)) === '#topic/modal_verbs');
  const selText = await page.evaluate(() => {
    const sel = document.getElementById('topicSelect');
    return sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '';
  });
  check('  Modal Verbs preselected in dropdown', /Modal Verbs/i.test(selText), 'got "' + selText + '"');
  await page.close();

  // 3. Family key match
  page = await freshPage('#practice/root_id/present_perfect');
  title = await page.textContent('#rootPracticeTitle');
  check('#practice/root_id/present_perfect → "Present Perfect"', title === 'Present Perfect', 'got "' + title + '"');
  await page.close();

  // 4. Granular id present in data
  page = await freshPage('#practice/root_id/B2.modals.speculation_past');
  title = await page.textContent('#rootPracticeTitle');
  check('#practice/root_id/B2.modals.speculation_past → Modal Verbs family', /Modal/i.test(title || ''), 'got "' + title + '"');
  await page.close();

  // 5. Granular id NOT in data → CEFR-segment parse fallback
  page = await freshPage('#practice/root_id/B1.modals.speculation_past');
  title = await page.textContent('#rootPracticeTitle');
  check('#practice/root_id/B1.modals.speculation_past → Modal Verbs (parse fallback)', /Modal/i.test(title || ''), 'got "' + title + '"');
  await page.close();

  // 6. Granular id where middle segment is not a family key
  page = await freshPage('#practice/root_id/A2.relative_clauses.basic');
  title = await page.textContent('#rootPracticeTitle');
  check('#practice/root_id/A2.relative_clauses.basic → Relative Pronouns (granular search)', /Relative/i.test(title || ''), 'got "' + title + '"');
  await page.close();

  // 7. Topic fallback form
  page = await freshPage('#practice/topic/present_perfect');
  check('#practice/topic/present_perfect → topic select panel', await page.isVisible('#menuTopicSelect'));
  await page.close();

  // 8. Bogus links fail soft
  page = await freshPage('#practice/root/bogus');
  check('#practice/root/bogus → main menu', await page.isVisible('#menuMain'));
  check('  notice shown', await page.isVisible('#deepLinkNotice'));
  await page.close();

  page = await freshPage('#practice/garbage');
  check('#practice/garbage → main menu + notice', (await page.isVisible('#menuMain')) && (await page.isVisible('#deepLinkNotice')));
  await page.close();

  // 9. Regression: legacy #topic/ route
  page = await freshPage('#topic/articles');
  check('#topic/articles → topic select panel (regression)', await page.isVisible('#menuTopicSelect'));
  await page.close();

  // 10. hashchange path (no reload)
  page = await freshPage('');
  check('plain load → main menu', await page.isVisible('#menuMain'));
  await page.evaluate(() => { location.hash = '#practice/root/noun_phrase'; });
  await page.waitForTimeout(300);
  title = await page.textContent('#rootPracticeTitle');
  check('live hashchange → Noun Phrase panel', /Noun Phrase/i.test(title || ''), 'got "' + title + '"');
  // In-app back from deep-link panel
  await page.locator('#rootPracticeBackBtn').click();
  await page.waitForTimeout(200);
  check('  in-app Back → main menu', await page.isVisible('#menuMain'));
  await page.close();

  // 11. Graceful degrade when index fetch is blocked (block SW so route interception applies)
  const noSwCtx = await browser.newContext({ serviceWorkers: 'block' });
  page = await noSwCtx.newPage();
  await page.route('**/root_content_index.json*', r => r.abort());
  await page.goto(BASE + '#practice/root/verb_phrase', { waitUntil: 'networkidle' });
  check('index blocked → app still loads, main menu + notice', (await page.isVisible('#menuMain')) && (await page.isVisible('#deepLinkNotice')));
  await noSwCtx.close();

  check('no console/page errors across all cases', consoleErrors.length === 0, consoleErrors.join(' | '));

  await browser.close();
  console.log(failures === 0 ? '\nAll deep-link checks passed.' : '\n' + failures + ' check(s) FAILED.');
  process.exit(failures === 0 ? 0 : 1);
})();

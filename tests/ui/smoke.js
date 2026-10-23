// Optional browser smoke test of the ported UI against a RUNNING server + seeded Neo4j.
// Not part of `npm test`. Requires Playwright:  npm i --no-save playwright && npx playwright install chromium
// Usage:  npm run seed && npm start   (in another terminal)  then  node tests/ui/smoke.js
// WARNING: it creates a booking and a member through the UI (re-run `npm run seed` afterwards).
// Set BLOCK_CDN=true where external CDNs are unreachable (styling is then missing, logic still works).
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'));
}
const BASE = process.env.BASE_URL || 'http://localhost:5000';
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.BLOCK_CDN === 'true') await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  page.on('dialog', d => d.accept());

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => /Neo4j 5/.test(document.getElementById('db-status-label').textContent));
  check('health badge shows live Neo4j', true, await page.textContent('#db-status-label'));
  await page.waitForFunction(() => document.getElementById('stat-spaces').textContent !== '-');
  check('dashboard stats loaded', (await page.textContent('#stat-spaces')).trim() === '4');

  await page.evaluate(() => switchTab('catalog'));
  check('catalog renders 14 room cards', (await page.$$eval('#rooms-catalog-cards > div', e => e.length)) === 14);

  await page.evaluate(() => openSlotPickerForRoom(301));
  check('slot grid blocks 4 booked hours for room 301 today', (await page.$$eval('#hourly-blocks-container .booked', e => e.length)) === 4);
  await page.evaluate(() => { handleSlotClick(12); launchCheckoutFromTimeline(); });
  await page.fill('#checkout-promo-input', 'VIT2026');
  await page.evaluate(() => applyPromoCode());
  check('checkout total with promo + GST', (await page.textContent('#checkout-grand-total')).includes('1132.80'));
  await page.evaluate(() => submitCompleteCheckout());
  await page.waitForFunction(() => !document.getElementById('tab-dashboard').classList.contains('hidden'));
  const created = await page.evaluate(async () => (await (await fetch('/api/bookings')).json()).data
    .find(b => b.ROOM_ID === 301 && b.START_TIME === '12:00' && b.STATUS === 'CONFIRMED'));
  check('booking written to Neo4j via the checkout UI', !!created);

  await page.evaluate(() => { switchTab('members'); openNewMemberModal(); });
  await page.fill('#member-first-name', 'Ui');
  await page.fill('#member-last-name', '<b>Tester</b>');
  await page.fill('#member-email', `ui.${Date.now()}@da3.dev`);
  await page.click('#member-submit-btn');
  await page.waitForFunction(() => document.getElementById('members-table-body').innerHTML.includes('&lt;b&gt;Tester'));
  check('member created via modal; HTML escaped', !(await page.$('#members-table-body b')));

  await page.evaluate(() => switchTab('query'));
  await page.waitForFunction(() => document.querySelectorAll('#demo-preset-groups button').length > 15);
  await page.evaluate(() => selectDemo('supervision_chain'));
  await page.waitForSelector('#graph-canvas canvas');
  check('preset renders a graph', true, await page.textContent('#graph-legend'));
  await page.fill('#cypher-input', 'MATCH (n) DETACH DELETE n');
  await page.click('#btn-run-query');
  await page.waitForFunction(() => !document.getElementById('query-error-container').classList.contains('hidden'));
  check('write query blocked in the console', /Read-only console/.test(await page.textContent('#query-error-text')));

  const relevant = errors.filter(e => !(process.env.BLOCK_CDN === 'true' && /tailwind is not defined/.test(e)));
  check('no JavaScript errors', relevant.length === 0, relevant.join(' | '));
  console.log(results.join('\n'));
  await browser.close();
  process.exitCode = results.some(r => r.startsWith('FAIL')) ? 1 : 0;
})();

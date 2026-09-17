// 使い方: npx serve . -l 4173 を別ターミナルで起動してから  node tests/smoke.mjs
// 環境変数 PLAYWRIGHT_MODULE で playwright の場所を指定できる
const mod = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(mod);
const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const errors = [];
const fail = m => { console.error('NG:', m); process.exitCode = 1; };
const b = await chromium.launch();

for (const vp of [{ name: 'tablet', width: 1180, height: 820 }, { name: 'phone', width: 390, height: 780 }]) {
  const p = await b.newPage({ viewport: vp });
  p.on('pageerror', e => errors.push(`${vp.name}: ${e.message}`));
  await p.goto(BASE);
  await p.click('#startBtn');
  await p.waitForTimeout(2500);
  const n = 3;
  for (let k = 0; k < n; k++) {
    const cs = await p.$$('.fcard:not(.gone)');
    await cs[(k * 17) % cs.length].click({ force: true });
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(900);
  for (const c of await p.$$('.slot .card')) { await c.click({ force: true }); await p.waitForTimeout(250); }
  await p.waitForTimeout(1400);
  const q = new URL(p.url()).searchParams;
  const cards = (q.get('cards') || '').split('-').filter(Boolean);
  if (cards.length !== n) fail(`${vp.name}: cards param = ${q.get('cards')}`);
  if (new Set(cards.map(c => parseInt(c, 10))).size !== cards.length) fail(`${vp.name}: duplicate card`);
  if (await p.$eval('#actions', e => e.hidden)) fail(`${vp.name}: actions not shown`);
  await p.screenshot({ path: `tests/screenshots/${vp.name}-result.png` }).catch(() => {});
  // 復元
  const r = await b.newPage({ viewport: vp });
  await r.goto(p.url());
  await r.waitForTimeout(500);
  if ((await r.$$('.slot .card.flipped')).length !== n) fail(`${vp.name}: restore failed`);
  await r.close(); await p.close();
}
await b.close();
if (errors.length) fail(errors.join('\n'));
if (!process.exitCode) console.log('OK');

'use strict';
/** UI smoke test: runs the real public/app.js in jsdom windows against the real server. */
const { JSDOM } = require('jsdom');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const BANK = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/questions.json'), 'utf8'));
const byText = Object.fromEntries(BANK.map(q => [q.question, q]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  PASS' : '  FAIL', m); };

async function boot(env) {
  const port = 4700 + Math.floor(Math.random() * 200);
  const proc = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: port, DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ui-')) }, env) });
  await new Promise(r => proc.stdout.on('data', d => String(d).includes('listening') && r()));
  return { port, proc, url: `http://127.0.0.1:${port}` };
}
async function open(url, label, copyStorageFrom) {
  const dom = await JSDOM.fromURL(url, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: true, addEventListener() {}, addListener() {} });   // reduced motion on: no animation timing noise
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.fetch = (u, o) => fetch(new URL(u, w.location.href).href, o);   // jsdom has no fetch
      if (copyStorageFrom) for (let i = 0; i < copyStorageFrom.window.localStorage.length; i++) { const k = copyStorageFrom.window.localStorage.key(i); w.localStorage.setItem(k, copyStorageFrom.window.localStorage.getItem(k)); }
      w.scrollTo = () => {};
      w.confirm = () => true;
      w.document.execCommand = () => true;
      w.navigator.clipboard = { writeText: async () => {} };
      w.console.error = (...a) => console.log(`[${label} console.error]`, ...a);
    }
  });
  await sleep(500);
  return dom;
}
const $ = (d, s) => d.window.document.querySelector(s);
const $$ = (d, s) => [...d.window.document.querySelectorAll(s)];
const text = d => d.window.document.getElementById('app').textContent;
const waitFor = async (fn, ms = 6000, what = '') => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch {} await sleep(40); } throw new Error('timeout: ' + what); };
function type(d, sel, val) { const el = $(d, sel); el.value = val; el.dispatchEvent(new d.window.Event('input', { bubbles: true })); }
const click = el => el.dispatchEvent(new (el.ownerDocument.defaultView.MouseEvent)('click', { bubbles: true }));

(async () => {
  const srv = await boot({ QUESTION_MS: 4000, MIN_REVEAL_MS: 500 });
  const wins = [];
  try {
    console.log('\n[UI] Create / join / play through the real interface');
    const host = await open(srv.url + '/', 'host'); wins.push(host);
    ok(/Host a game/.test(text(host)), 'Create Game screen renders');
    type(host, '#hname', 'Hannah');
    click($(host, '#plays')); click($(host, '#plays'));          // toggle off/on: still checked
    $(host, '#qcount').value = '10';
    click($$(host, 'button').find(b => /Create game/.test(b.textContent)));
    await waitFor(() => /Your game is open/.test(text(host)), 6000, 'host lobby');
    const link = $(host, 'input[aria-label="Game link"]').value;
    ok(/\/g\/[A-Z2-9]{6}$/.test(link), 'host sees a shareable game link: ' + link);
    ok(!!$(host, '.hostbar') && /Start game/.test($(host, '.hostbar').textContent), 'host control bar is shown to the host');

    const mk = async name => {
      const d = await open(link, name); wins.push(d);
      ok(/Join the game/.test(text(d)), `${name}: Join Game screen renders from the shared link`);
      type(d, '#pname', name);
      click($$(d, 'button').find(b => /Join game/.test(b.textContent)));
      await waitFor(() => /You're in!/.test(text(d)), 5000, name + ' lobby');
      return d;
    };
    const ana = await mk('Ana'), ben = await mk('Ben');
    await waitFor(() => $$(host, '.player-chip').length === 3, 4000, 'host sees 3 players');
    ok(true, 'host sees live player list: ' + $$(host, '.player-chip').map(c => c.textContent.replace(/[×]/g, '')).join(' | '));
    ok(/Waiting for the host/.test(text(ana)) && !$(ana, '.hostbar'), 'players see "waiting for host" and no host controls');
    await waitFor(() => $$(ana, '.player-chip').length === 3 && $$(ben, '.player-chip').length === 3, 3000, 'players converge');
    ok(true, 'players see the same list and count');

    // duplicate name via UI
    const dup = await open(link, 'dup'); wins.push(dup);
    type(dup, '#pname', 'ana'); click($$(dup, 'button').find(b => /Join game/.test(b.textContent)));
    await waitFor(() => /already taken/.test(text(dup)), 4000, 'duplicate name message');
    ok(true, 'duplicate name shows a clear error in the UI');

    // start
    click($$(host, '.hostbar button').find(b => /Start game/.test(b.textContent)));
    await waitFor(() => $(ana, '.answers button') && $(ben, '.answers button'), 5000, 'question screens');
    ok($$(ana, '.answers button').length === 4, 'player sees four large answer cards');
    ok(/Question 1 of 10/.test(text(ana)) && /Question 1 of 10/.test(text(host)), 'everyone is on the same question');
    const qText = $(ana, '.question-text').textContent;
    const correct = byText[qText].correct;
    const idxOf = d => $$(d, '.answers button').findIndex(b => b.textContent.includes(correct) && b.querySelector('span:nth-child(2)').textContent === correct);
    const n0 = Number($(ana, '.timer .num').textContent);
    ok(n0 >= 3 && n0 <= 4, `countdown is running (shows ${n0}s of a 4s test round)`);
    ok(!/Correct/.test(text(ana)), 'correct answer is not shown while the clock runs');
    click($$(ana, '.answers button')[idxOf(ana)]);
    await sleep(80);
    click($$(ben, '.answers button')[[0, 1, 2, 3].find(i => i !== idxOf(ben))]);
    await waitFor(() => /locked in/i.test(text(ana)), 3000, 'lock confirmation');
    ok($$(ana, '.answers button').every(b => b.disabled), 'answer cards lock after submitting');
    ok(/Answer locked in|locked in/i.test($(ana, '.status').textContent), 'player gets confirmation that the answer was recorded');
    await sleep(500);
    ok(/Locked in/.test($(ana, '.answers').textContent), 'chosen card is marked "Locked in"');

    // reveal
    await waitFor(() => $(ana, '.result') && $(ben, '.result'), 6000, 'reveal');
    ok($(ana, '.result.good') && /\+1,000/.test($(ana, '.result').textContent), 'Ana (first correct) sees +1,000');
    ok($(ben, '.result.bad') && /Not this time/.test($(ben, '.result').textContent), 'Ben (wrong) sees incorrect feedback');
    ok($(ana, '.answer.correct') && /✓/.test($(ana, '.answer.correct').textContent), 'correct option is highlighted (with a check mark, not colour alone)');
    ok(/had the fastest correct answer/.test(text(ana)) && /Ana/.test($(ana, '.fast').textContent), 'fastest correct answer is announced');
    ok(/Why:/.test(text(ben)) && /Source:/.test(text(ben)), 'explanation and source are shown');
    ok($$(ana, '.board li').length >= 3 && $$(host, '.board li')[0].textContent.includes('Ana'), 'leaderboard shows Ana first');
    ok(/Waiting for the host to continue/.test(text(ana)), 'players are told the host controls pacing');
    const nextBtn = () => $$(host, '.hostbar button').find(b => /Next question|See final/.test(b.textContent));
    await waitFor(() => nextBtn() && !nextBtn().disabled, 4000, 'next enabled');
    click(nextBtn());
    await waitFor(() => /Question 2 of 10/.test(text(ana)), 4000, 'question 2');
    ok(true, 'host advances everyone to question 2');

    // refresh a player mid-game
    const ana2 = await open(link, 'ana-refresh', ana); wins.push(ana2);
    await waitFor(() => /Question 2 of 10/.test(text(ana2)), 4000, 'refresh restores');
    ok(!/Join the game/.test(text(ana2)), 'refreshing the page restores the player (no re-join needed)');

    // end game early -> final
    click($$(host, '.hostbar button').find(b => /End game/.test(b.textContent)));
    await waitFor(() => /Final results/.test(text(ana)), 4000, 'final');
    ok(/Ana wins with 1,000 points!/.test(text(ana)), 'winner is announced: ' + $(ana, 'h1').textContent);
    ok($$(ana, '.pod').length === 3 && $(ana, '.pod.p1 .who').textContent === 'Ana', 'podium shows first, second and third');
    const rows = $$(ana, 'table.results tbody tr');
    ok(rows.length === 3 && /Correct/.test($(ana, 'table.results').textContent) && /Avg\. time/.test($(ana, 'table.results').textContent), 'results table lists points, correct answers and average time');
    ok(/Play again/.test($(host, '.hostbar').textContent) && !$(ana, '.hostbar'), 'only the host gets Play again / New game');
    click($$(host, '.hostbar button').find(b => /Play again/.test(b.textContent)));
    await waitFor(() => /Your game is open/.test(text(host)) && /You're in!/.test(text(ana)), 4000, 'back to lobby');
    ok(true, 'Play again returns everyone to the lobby');
  } catch (e) { fail++; console.log('  FAIL (exception):', e.message); }
  finally { wins.forEach(w => w.window.close()); srv.proc.kill(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

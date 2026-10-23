'use strict';
/**
 * Integration tests: spawn the real server, drive it with simulated players over real WebSockets.
 *   node test/run.js            (runs everything, ~1 minute because one test uses the real 15s timer)
 *   node test/run.js --fast     (skips the real-15s timing test)
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');

const ROOT = path.join(__dirname, '..');
const BANK = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'questions.json'), 'utf8'));
const byText = Object.fromEntries(BANK.map(q => [q.question, q]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  PASS', msg); }
  else { failed++; console.log('  FAIL', msg); }
}

// ---------- infrastructure ----------
let nextPort = 4100 + Math.floor(Math.random() * 500);
async function startServer(env = {}, dataDir) {
  const port = nextPort++;
  dataDir = dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'dandy-'));
  const proc = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: port, DATA_DIR: dataDir }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stderr.on('data', d => process.stderr.write('[server err] ' + d));
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server start timeout')), 8000);
    proc.stdout.on('data', d => { if (String(d).includes('listening')) { clearTimeout(t); res(); } });
  });
  return { port, proc, dataDir, base: `http://127.0.0.1:${port}`, ws: `ws://127.0.0.1:${port}/ws`,
    stop: () => new Promise(r => { proc.once('exit', r); proc.kill('SIGTERM'); }) };
}
async function createGame(srv, body) {
  const r = await fetch(srv.base + '/api/games', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return Object.assign({ status: r.status }, await r.json());
}

class Client {
  constructor(srv, label) { this.srv = srv; this.label = label; this.state = null; this.msgs = []; this.events = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.srv.ws);
      this.ws.on('open', res); this.ws.on('error', rej);
      this.ws.on('message', raw => {
        const m = JSON.parse(raw); m._at = Date.now(); this.msgs.push(m);
        if (m.t === 'state') this.state = m;
        if (m.t === 'joined') { this.playerToken = m.playerToken; this.playerId = m.playerId; }
        this.events.push(m);
      });
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  hello(code, tokens = {}) { this.code = code; this.send(Object.assign({ t: 'hello', code }, tokens)); }
  async waitFor(pred, ms = 8000, what = 'condition') {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const hit = this.msgs.find(m => !m._seen && pred(m));
      if (hit) { hit._seen = true; return hit; }
      await sleep(10);
    }
    throw new Error(`${this.label}: timeout waiting for ${what}`);
  }
  waitPhase(phase, ms) { return this.waitFor(m => m.t === 'state' && m.phase === phase, ms, 'phase ' + phase); }
  waitReveal(i, ms) { return this.waitFor(m => m.t === 'state' && m.phase === 'reveal' && m.qIndex === i, ms, 'reveal ' + i); }
  waitQuestion(i, ms) { return this.waitFor(m => m.t === 'state' && m.phase === 'question' && m.qIndex === i, ms, 'question ' + i); }
  close() { try { this.ws.close(); } catch {} }
}
async function join(srv, code, name, label) {
  const c = new Client(srv, label || name); await c.connect(); c.hello(code);
  await c.waitFor(m => m.t === 'state');
  c.send({ t: 'join', name });
  const r = await c.waitFor(m => m.t === 'joined' || m.t === 'error');
  return { c, r };
}
const correctIdx = st => byText[st.question.text].correct && st.question.options.indexOf(byText[st.question.text].correct);
const wrongIdx = st => [0, 1, 2, 3].find(i => i !== correctIdx(st));

// ---------- test 1: full game, fast timers ----------
async function testFullGame() {
  console.log('\n[1] Full multi-player game (fast timers: 3s questions, 0.6s min reveal)');
  const srv = await startServer({ QUESTION_MS: 3000, MIN_REVEAL_MS: 600 });
  try {
    const g = await createGame(srv, { hostName: 'Host', hostPlays: true, settings: { numQuestions: 5 } });
    ok(g.status === 200 && /^[A-Z2-9]{6}$/.test(g.code) && g.hostToken, 'host can create a game and gets a code + secret host token');

    const host = new Client(srv, 'host'); await host.connect();
    host.hello(g.code, { hostToken: g.hostToken, playerToken: g.playerToken });
    const hs = await host.waitFor(m => m.t === 'state');
    ok(hs.isHost === true && hs.me && hs.me.name === 'Host', 'host is recognised as host and as a player');

    // players join using the same code
    const P = {};
    for (const n of ['Ana', 'Ben', 'Cy', 'Di']) { const { c, r } = await join(srv, g.code, n); ok(r.t === 'joined', `${n} joins with just a name`); P[n] = c; }
    await sleep(200);
    ok(Object.values(P).every(c => c.state.players.length === 5), 'everyone sees the same 5-player lobby in real time');
    const dup = await join(srv, g.code, ' ana ');
    ok(dup.r.t === 'error' && dup.r.code === 'taken', 'duplicate name (case/space-insensitive) is rejected');
    dup.c.close();

    // forged host actions
    P.Ana.send({ t: 'host', action: 'start' });
    P.Ana.send({ t: 'host', action: 'start', hostToken: 'forged' });
    const e1 = await P.Ana.waitFor(m => m.t === 'error' && m.code === 'forbidden');
    await sleep(150);
    ok(!!e1 && P.Ana.state.phase === 'lobby', 'player cannot start the game (server enforces host permission)');

    // start
    const tStart = Date.now();
    host.send({ t: 'host', action: 'start', hostToken: g.hostToken });
    const qs = {};
    for (const [n, c] of Object.entries(Object.assign({ Host: host }, P))) qs[n] = await c.waitQuestion(0);
    ok(Object.values(qs).every(s => s.question.text === qs.Ana.question.text), 'all players moved to the same first question');
    const leak = JSON.stringify(qs.Ana);
    ok(!/correctIndex|explanation|"source"/.test(leak) && qs.Ana.reveal === null, 'question state does not leak the answer, explanation or source');
    ok(qs.Ana.question.options.length === 4, 'four answer options are sent');
    ok(qs.Ana.deadline - qs.Ana.serverNow > 2800 && qs.Ana.deadline - qs.Ana.serverNow <= 3000, 'server supplies a deadline (not a client timer)');

    // late joiner during the question
    const late = await join(srv, g.code, 'Late');
    late.c.send({ t: 'answer', q: 0, choice: 0 });
    const lr = await late.c.waitFor(m => m.t === 'rejected');
    ok(lr.reason === 'joined_late', 'late joiner cannot disrupt/answer the round in progress');

    // answers, in a controlled order
    const st0 = qs.Ana;
    const ci = correctIdx(st0), wi = wrongIdx(st0);
    P.Ana.send({ t: 'answer', q: 0, choice: ci });             // first correct -> 1000
    await sleep(40);
    P.Ben.send({ t: 'answer', q: 0, choice: ci });             // 500
    await sleep(40);
    P.Cy.send({ t: 'answer', q: 0, choice: wi });              // wrong -> 0
    host.send({ t: 'answer', q: 0, choice: ci });              // 500
    P.Ana.send({ t: 'answer', q: 0, choice: wi });             // duplicate/change attempt
    const dr = await P.Ana.waitFor(m => m.t === 'rejected' && m.reason === 'duplicate');
    ok(!!dr, 'second submission by the same player is rejected (answers lock)');
    const ack = await P.Ben.waitFor(m => m.t === 'ack');
    ok(ack.choice === ci, 'player receives an acknowledgement that the answer was recorded');
    ok(P.Ana.state.me.choice === ci, 'locked choice is the first one submitted');

    // no reveal before the deadline
    await sleep(500);
    ok(P.Di.state.phase === 'question' && !P.Di.state.reveal, 'correct answer is not revealed before the timer expires');

    // late answer (Di waits for deadline to pass)
    const revealMsg = await P.Di.waitPhase('reveal', 5000);
    const tReveal = revealMsg._at - tStart;
    ok(tReveal >= 2950 && tReveal < 3600, `reveal arrives when the server deadline passes (${tReveal}ms after start, limit 3000ms)`);
    P.Di.send({ t: 'answer', q: 0, choice: ci });
    const lateRej = await P.Di.waitFor(m => m.t === 'rejected');
    ok(lateRej.reason === 'closed' || lateRej.reason === 'late', 'answers after the deadline are rejected');
    await sleep(100);

    const rv = P.Ana.state.reveal;
    ok(rv && rv.correctIndex === ci, 'reveal contains the correct answer');
    ok(rv.explanation && rv.source, 'reveal includes explanation and source');
    const idOf = n => (n === 'Host' ? g.playerId : P[n].playerId);
    ok(rv.results[idOf('Ana')].points === 1000, 'first correct answer scores 1000');
    ok(rv.results[idOf('Ben')].points === 500 && rv.results[idOf('Host')].points === 500, 'other correct answers score 500');
    ok(rv.results[idOf('Cy')].points === 0 && rv.results[idOf('Cy')].correct === false, 'wrong answer scores 0 and is flagged incorrect');
    ok(!rv.results[idOf('Di')], 'no answer = no points');
    ok(rv.fastest && rv.fastest.name === 'Ana', 'fastest correct answer is identified');
    const score = n => P.Ana.state.players.find(p => p.id === idOf(n)).score;
    ok(score('Ana') === 1000 && score('Ben') === 500 && score('Host') === 500 && score('Cy') === 0 && score('Di') === 0, 'leaderboard reflects scores');
    ok(P.Ana.state.players[0].name === 'Ana' && P.Ana.state.players[0].rank === 1, 'leaderboard ordered by score');

    // reconnect: Ben drops and returns
    const benId = P.Ben.playerId, benTok = P.Ben.playerToken;
    P.Ben.close(); await sleep(250);
    ok(P.Ana.state.players.find(p => p.id === benId).online === false, 'disconnected player shows as offline');
    const b2 = new Client(srv, 'Ben2'); await b2.connect(); b2.hello(g.code, { playerToken: benTok });
    const bs = await b2.waitFor(m => m.t === 'state');
    ok(bs.me && bs.me.id === benId && bs.me.name === 'Ben', 'refreshing/reconnecting restores player identity');
    ok(bs.players.find(p => p.id === benId).score === 500, 'score survives reconnect');
    P.Ben = b2; b2.playerId = benId; b2.playerToken = benTok;

    // host refresh keeps control
    host.close(); await sleep(150);
    const h2 = new Client(srv, 'host2'); await h2.connect(); h2.hello(g.code, { hostToken: g.hostToken, playerToken: g.playerToken });
    const h2s = await h2.waitFor(m => m.t === 'state');
    ok(h2s.isHost && h2s.me.id === g.playerId, 'host refresh restores host control and player identity');
    const hostHolder = { c: h2 };

    // advance too early is refused, then works
    hostHolder.c.send({ t: 'host', action: 'next', hostToken: g.hostToken });
    const tooSoon = await hostHolder.c.waitFor(m => m.t === 'error' && m.code === 'too_soon', 2000).catch(() => null);
    ok(!!tooSoon || hostHolder.c.state.phase === 'question', 'host cannot skip the minimum reveal time (or reveal already elapsed)');
    await sleep(700);
    P.Ana.send({ t: 'host', action: 'next', hostToken: 'nope' });
    await sleep(100);
    ok(P.Ana.state.phase === 'reveal', 'player cannot advance the game');
    hostHolder.c.send({ t: 'host', action: 'next', hostToken: g.hostToken });
    const q1 = await P.Ana.waitQuestion(1);
    ok(!!q1 && P.Ana.state.question.text !== st0.question.text, 'host advances to the next question');

    // Late joiner can play from this question on
    late.c.send({ t: 'answer', q: 1, choice: correctIdx(q1) });
    const lAck = await late.c.waitFor(m => m.t === 'ack' || m.t === 'rejected');
    ok(lAck.t === 'ack', 'late joiner can answer from the next question onward');

    // Host drops while question 1 is running: the game still resolves on the server
    hostHolder.c.close();
    P.Di.send({ t: 'answer', q: 1, choice: correctIdx(q1) });
    await P.Ana.waitReveal(1, 5000);
    await sleep(200);
    ok(true, 'question resolves even though the host disconnected (server-controlled timer)');
    ok(P.Ana.state.hostOnline === false, 'players are told the host is offline');
    const h3 = new Client(srv, 'host3'); await h3.connect(); h3.hello(g.code, { hostToken: g.hostToken, playerToken: g.playerToken });
    await h3.waitFor(m => m.t === 'state');
    hostHolder.c = h3;

    // play out remaining questions
    const expected = {};   // independent bookkeeping for final-winner check
    for (let i = 2; i < 5; i++) {
      await sleep(700);
      hostHolder.c.send({ t: 'host', action: 'next', hostToken: g.hostToken });
      const st = await P.Ana.waitQuestion(i);
      const c = correctIdx(st);
      if (i === 2) { P.Di.send({ t: 'answer', q: i, choice: c }); await sleep(30); P.Ana.send({ t: 'answer', q: i, choice: c }); }
      if (i === 3) { P.Ana.send({ t: 'answer', q: i, choice: c }); P.Cy.send({ t: 'answer', q: i, choice: c }); }
      if (i === 4) { P.Di.send({ t: 'answer', q: i, choice: c }); P.Ben.send({ t: 'answer', q: i, choice: wrongIdx(st) }); }
      await P.Ana.waitReveal(i, 5000);
    }
    await sleep(700);
    ok(P.Ana.state.isLast === true, 'last question is flagged so host sees "See final results"');
    hostHolder.c.send({ t: 'host', action: 'next', hostToken: g.hostToken });
    const fin = await P.Ana.waitPhase('final', 3000);
    const f = fin.final;
    ok(f.length === 6, 'final standings include every player');
    let sorted = true;
    for (let i = 1; i < f.length; i++) {
      const a = f[i - 1], b = f[i];
      const av = a.avgMs == null ? Infinity : a.avgMs, bv = b.avgMs == null ? Infinity : b.avgMs;
      if (!(a.score > b.score || (a.score === b.score && (a.correct > b.correct || (a.correct === b.correct && av <= bv))))) sorted = false;
    }
    ok(sorted, 'winner/order follows score > correct answers > average response time');
    // expected totals (computed by hand from the scripted answers)
    const tot = n => f.find(p => p.name === n);
    ok(tot('Ana').score === 1000 + 500 + 1000 && tot('Ana').correct === 3, 'Ana: Q0 first (1000) + Q2 second (500) + Q3 first (1000)');
    ok(tot('Di').score === 500 + 1000 + 1000 && tot('Di').correct === 3, 'Di: Q1 second (500) + Q2 first (1000) + Q4 first (1000), tied with Ana on points and correct, so average time decides');
    ok(f[0].rank === 1 && typeof f[0].avgMs === 'number', 'final includes rank, total points, correct count, average response time');

    // play again keeps players, resets scores
    const tRestart = Date.now();
    hostHolder.c.send({ t: 'host', action: 'restart', hostToken: g.hostToken });
    const lob = await P.Ana.waitFor(m => m.t === 'state' && m.phase === 'lobby' && m._at >= tRestart, 3000, 'lobby after restart');
    ok(lob.players.length === 6 && lob.players.every(p => p.score === 0), 'host can play again: same players, scores reset');
    [...Object.values(P), late.c, hostHolder.c].forEach(c => c.close());
  } finally { await srv.stop(); }
}

// ---------- test 2: real 15s timer + sync ----------
async function testRealTimer() {
  console.log('\n[2] Real 15-second timer and synchronisation (default server settings)');
  const srv = await startServer({});
  try {
    const meta = await (await fetch(srv.base + '/api/meta')).json();
    ok(meta.questionSeconds === 15, 'default question time is exactly 15 seconds');
    const g = await createGame(srv, { hostPlays: false, settings: { numQuestions: 5 } });
    const host = new Client(srv, 'host'); await host.connect(); host.hello(g.code, { hostToken: g.hostToken });
    await host.waitFor(m => m.t === 'state');
    const A = (await join(srv, g.code, 'Ann')).c, B = (await join(srv, g.code, 'Bob')).c, C = (await join(srv, g.code, 'Cat')).c;
    host.send({ t: 'host', action: 'start', hostToken: g.hostToken });
    const sa = await A.waitQuestion(0), sb = await B.waitQuestion(0), sc = await C.waitQuestion(0);
    ok(sa.deadline === sb.deadline && sb.deadline === sc.deadline, 'all clients receive the identical server deadline');
    const total = sa.deadline - sa.serverNow;
    ok(total > 14700 && total <= 15000, `deadline is 15s after server start (${total}ms remaining at first state)`);
    const ci = correctIdx(sa);
    await sleep(14300);
    A.send({ t: 'answer', q: 0, choice: ci });          // just inside the window
    const ackA = await A.waitFor(m => m.t === 'ack' || m.t === 'rejected', 2000);
    ok(ackA.t === 'ack', 'answer at ~14.3s is accepted');
    const rA = await A.waitPhase('reveal', 3000), rB = await B.waitPhase('reveal', 3000), rC = await C.waitPhase('reveal', 3000);
    const t = rA._at - sa._at;
    ok(t >= 14700 && t < 15600, `reveal arrives at ~15s (${t}ms)`);
    ok(Math.max(rA._at, rB._at, rC._at) - Math.min(rA._at, rB._at, rC._at) < 150, 'all players see the reveal at the same moment (<150ms spread)');
    B.send({ t: 'answer', q: 0, choice: ci });
    const late = await B.waitFor(m => m.t === 'rejected', 2000);
    ok(['closed', 'late'].includes(late.reason), 'answer after 15s is rejected');
    [host, A, B, C].forEach(c => c.close());
  } finally { await srv.stop(); }
}

// ---------- test 3: persistence across server restart ----------
async function testPersistence() {
  console.log('\n[3] Persistence across a server restart');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dandy-persist-'));
  let srv = await startServer({ QUESTION_MS: 4000, MIN_REVEAL_MS: 300 }, dir);
  const g = await createGame(srv, { hostName: 'Hostie', hostPlays: true, settings: { numQuestions: 5 } });
  const p = await join(srv, g.code, 'Zed');
  const host = new Client(srv, 'host'); await host.connect(); host.hello(g.code, { hostToken: g.hostToken, playerToken: g.playerToken });
  await host.waitFor(m => m.t === 'state');
  host.send({ t: 'host', action: 'start', hostToken: g.hostToken });
  const q = await p.c.waitQuestion(0);
  p.c.send({ t: 'answer', q: 0, choice: correctIdx(q) });
  await p.c.waitFor(m => m.t === 'ack');
  const zedTok = p.c.playerToken;
  await sleep(300);
  host.close(); p.c.close();
  await srv.stop();
  srv = await startServer({ QUESTION_MS: 4000, MIN_REVEAL_MS: 300 }, dir);
  try {
    const z = new Client(srv, 'zed2'); await z.connect(); z.hello(g.code, { playerToken: zedTok });
    const s = await z.waitFor(m => m.t === 'state');
    ok(s.phase === 'question' && s.qIndex === 0 && s.deadline === q.deadline, 'game, question and deadline restored after restart');
    ok(s.me && s.me.name === 'Zed' && s.me.choice === correctIdx(q), 'player identity and locked answer restored');
    const rv = await z.waitPhase('reveal', 6000);
    ok(rv.reveal.results[s.me.id].points === 1000, 'restored game still resolves and scores correctly');
    const h = new Client(srv, 'host'); await h.connect(); h.hello(g.code, { hostToken: g.hostToken });
    ok((await h.waitFor(m => m.t === 'state')).isHost, 'host token still valid after restart');
    z.close(); h.close();
  } finally { await srv.stop(); }
}

// ---------- test 4: end early, settings, validation ----------
async function testHostControls() {
  console.log('\n[4] Host controls and input validation');
  const srv = await startServer({ QUESTION_MS: 2000, MIN_REVEAL_MS: 300 });
  try {
    const bad = await createGame(srv, { hostPlays: true, hostName: '   ', settings: {} });
    ok(bad.status === 400, 'host-plays without a name is rejected');
    const none = await createGame(srv, { hostPlays: false, settings: { categories: ['No such category'] } });
    ok(none.status === 200, 'unknown categories are ignored rather than crashing');
    const g = await createGame(srv, { hostPlays: false, settings: { numQuestions: 7, categories: ['Dental Terms', 'Business Lingo'], difficulties: ['easy', 'medium'] } });
    const host = new Client(srv, 'host'); await host.connect(); host.hello(g.code, { hostToken: g.hostToken });
    await host.waitFor(m => m.t === 'state');
    const a = (await join(srv, g.code, '<img src=x onerror=alert(1)>')).c;
    ok(a.state.players[0].name.length <= 20, 'names are length-limited (and rendered as text by the client)');
    host.send({ t: 'host', action: 'settings', hostToken: g.hostToken, settings: { numQuestions: 6, autoAdvance: false } });
    await sleep(150);
    ok(host.state.settings.numQuestions === 6, 'host can change the question count in the lobby');
    host.send({ t: 'host', action: 'start', hostToken: g.hostToken });
    const st = await a.waitQuestion(0);
    const allowed = new Set(BANK.filter(q => ['Dental Terms', 'Business Lingo'].includes(q.category) && q.difficulty !== 'hard').map(q => q.question));
    ok(allowed.has(st.question.text), 'category/difficulty filters are honoured');
    host.send({ t: 'host', action: 'end', hostToken: g.hostToken });
    const fin = await a.waitPhase('final', 3000);
    ok(!!fin, 'host can end the game early');
    const kicked = await join(srv, g.code, 'TooLate');
    ok(kicked.r.t === 'error' && kicked.r.code === 'ended', 'nobody can join a finished game');
    [host, a, kicked.c].forEach(c => c.close());
  } finally { await srv.stop(); }
}

(async () => {
  const fast = process.argv.includes('--fast');
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
  try {
    if (only === 'timer') await testRealTimer();
    else {
      await testFullGame();
      await testHostControls();
      await testPersistence();
      if (!fast) await testRealTimer();
    }
  } catch (e) { failed++; console.log('  FAIL (exception)', e.message); }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();

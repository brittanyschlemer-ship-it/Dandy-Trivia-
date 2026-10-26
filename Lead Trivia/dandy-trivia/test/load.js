'use strict';
// 60 simultaneous players, one question: exactly one 1000-point winner, everyone else correct gets 500.
const { spawn } = require('child_process'); const WebSocket = require('ws');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const BANK = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/questions.json'), 'utf8'));
const byText = Object.fromEntries(BANK.map(q => [q.question, q]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const port = 5100 + Math.floor(Math.random() * 300);
  const proc = spawn('node', ['server.js'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: port, QUESTION_MS: 3000, DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ld-')) }) });
  await new Promise(r => proc.stdout.on('data', d => String(d).includes('listening') && r()));
  const g = await (await fetch(`http://127.0.0.1:${port}/api/games`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hostPlays: false, settings: { numQuestions: 5 } }) })).json();
  const mk = name => new Promise(res => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); const c = { ws, name, st: null };
    ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', code: g.code })); ws.send(JSON.stringify({ t: 'join', name })); });
    ws.on('message', raw => { const m = JSON.parse(raw); if (m.t === 'state') { c.st = m; if (m.me && !c.ready) { c.ready = true; res(c); } } });
  });
  const players = await Promise.all(Array.from({ length: 60 }, (_, i) => mk('P' + i)));
  const host = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise(r => host.on('open', r));
  host.send(JSON.stringify({ t: 'hello', code: g.code, hostToken: g.hostToken }));
  await sleep(300);
  console.log('players in lobby seen by P59:', players[59].st.players.length);
  host.send(JSON.stringify({ t: 'host', action: 'start', hostToken: g.hostToken }));
  await sleep(300);
  const st = players[0].st, q = byText[st.question.text];
  const ci = st.question.options.indexOf(q.correct);
  players.forEach((p, i) => p.ws.send(JSON.stringify({ t: 'answer', q: 0, choice: i % 3 === 0 ? (ci + 1) % 4 : ci })));
  await sleep(3500);
  const fin = players[5].st;
  const pts = fin.players.map(p => p.score);
  const wrong = players.filter((_, i) => i % 3 === 0).length;
  console.log('phase:', fin.phase, '| 1000s:', pts.filter(x => x === 1000).length, '| 500s:', pts.filter(x => x === 500).length, '| 0s:', pts.filter(x => x === 0).length);
  const good = fin.phase === 'reveal' && pts.filter(x => x === 1000).length === 1 && pts.filter(x => x === 500).length === 60 - wrong - 1 && pts.filter(x => x === 0).length === wrong;
  console.log(good ? 'PASS load: exactly one first-correct bonus, scores consistent for 60 players' : 'FAIL load');
  proc.kill(); process.exit(good ? 0 : 1);
})();

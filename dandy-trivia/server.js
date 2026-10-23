'use strict';
/**
 * Dandy Trivia - authoritative real-time game server.
 *
 * Everything that matters is decided here, never in the browser:
 *   - host permissions (secret host token, verified on every host message)
 *   - question timing (server-controlled deadline)
 *   - answer acceptance, ordering and scoring
 *   - correct answers are never sent to clients before the reveal
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

// ---------- configuration ----------
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'games.json');
const QUESTION_MS = Number(process.env.QUESTION_MS || 15000);          // spec: exactly 15 seconds
const MIN_REVEAL_MS = Number(process.env.MIN_REVEAL_MS || 5000);       // spec: ~5s reveal before host may advance
const AUTO_ADVANCE_MS = Number(process.env.AUTO_ADVANCE_MS || 10000);  // optional auto-advance after reveal
const FIRST_POINTS = 1000;
const OTHER_POINTS = 500;
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 150);
const MAX_GAMES = 500;
const GAME_TTL_MS = 24 * 60 * 60 * 1000;
const NAME_MAX = 20;

const BANK = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8'));
const CATEGORIES = [...new Set(BANK.map(q => q.category))].sort();
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// ---------- helpers ----------
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const rndToken = () => crypto.randomBytes(24).toString('hex');
const rndId = () => crypto.randomBytes(6).toString('hex');
function safeEq(aHex, bHex) {
  const a = Buffer.from(aHex, 'hex'), b = Buffer.from(bHex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 6; i++) c += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!games.has(c)) return c;
  }
}
function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.normalize('NFKC').replace(/[\p{C}\p{Zl}\p{Zp}]/gu, '').replace(/\s+/g, ' ').trim();
  s = Array.from(s).slice(0, NAME_MAX).join('').trim();
  return s;
}
const nameKey = n => n.toLowerCase();

// ---------- state ----------
/** @type {Map<string, any>} */
const games = new Map();
/** runtime-only, never persisted: code -> { conns:Set<ws>, timer, autoTimer, bcast } */
const runtime = new Map();
const rt = code => {
  if (!runtime.has(code)) runtime.set(code, { conns: new Set(), timer: null, autoTimer: null, bcast: null });
  return runtime.get(code);
};

function clampSettings(input, prev) {
  const s = Object.assign({ numQuestions: 15, categories: [], difficulties: [], autoAdvance: false }, prev || {});
  if (input && typeof input === 'object') {
    if (Number.isFinite(Number(input.numQuestions))) s.numQuestions = Math.max(5, Math.min(50, Math.floor(Number(input.numQuestions))));
    if (Array.isArray(input.categories)) s.categories = input.categories.filter(c => CATEGORIES.includes(c));
    if (Array.isArray(input.difficulties)) s.difficulties = input.difficulties.filter(d => DIFFICULTIES.includes(d));
    if (typeof input.autoAdvance === 'boolean') s.autoAdvance = input.autoAdvance;
  }
  return s;
}
function pool(settings) {
  return BANK.filter(q =>
    (!settings.categories.length || settings.categories.includes(q.category)) &&
    (!settings.difficulties.length || settings.difficulties.includes(q.difficulty)));
}

// ---------- persistence ----------
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 300);
}
function saveNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ savedAt: Date.now(), games: [...games.values()] }));
    fs.renameSync(tmp, STATE_FILE);
  } catch (e) { console.error('persist failed:', e.message); }
}
function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    for (const g of raw.games || []) {
      if (Date.now() - g.updatedAt > GAME_TTL_MS) continue;
      games.set(g.code, g);
    }
    for (const g of games.values()) resumeTimers(g);
    console.log(`restored ${games.size} game(s)`);
  } catch (e) { if (e.code !== 'ENOENT') console.error('load failed:', e.message); }
}
function touch(g) { g.updatedAt = Date.now(); scheduleSave(); }

// ---------- ranking ----------
function avgMs(p) { return p.answeredCount ? p.totalMs / p.answeredCount : Infinity; }
function standings(g) {
  const list = Object.values(g.players).sort((a, b) =>
    b.score - a.score || b.correct - a.correct || avgMs(a) - avgMs(b) || a.name.localeCompare(b.name));
  list.forEach((p, i) => { p.rank = i + 1; });
  return list;
}

// ---------- game flow ----------
function pickQuestions(settings) {
  const chosen = shuffle(pool(settings)).slice(0, settings.numQuestions);
  return chosen.map(q => {
    const options = shuffle([q.correct, ...q.wrong]);
    return {
      id: q.id, category: q.category, difficulty: q.difficulty, text: q.question,
      options, correctIndex: options.indexOf(q.correct), explanation: q.explanation, source: q.source
    };
  });
}

function startGame(g) {
  g.questions = pickQuestions(g.settings);
  for (const p of Object.values(g.players)) { p.score = 0; p.correct = 0; p.totalMs = 0; p.answeredCount = 0; p.joinedAtQ = -1; }
  g.qIndex = -1;
  beginNextQuestion(g);
}

function beginNextQuestion(g) {
  const r = rt(g.code);
  clearTimeout(r.timer); clearTimeout(r.autoTimer);
  g.qIndex += 1;
  g.answers = {};
  g.seq = 0;
  g.reveal = null;
  g.phase = 'question';
  g.startedAt = Date.now();
  g.deadline = g.startedAt + QUESTION_MS;
  armDeadline(g);
  touch(g);
  broadcastNow(g);
}

function armDeadline(g) {
  const r = rt(g.code);
  clearTimeout(r.timer);
  const wait = Math.max(0, g.deadline - Date.now());
  r.timer = setTimeout(() => {
    if (g.phase !== 'question') return;
    if (Date.now() < g.deadline) return armDeadline(g); // timers may fire a hair early
    doReveal(g);
  }, wait);
}

function doReveal(g) {
  const q = g.questions[g.qIndex];
  const correct = Object.entries(g.answers)
    .filter(([, a]) => a.choice === q.correctIndex)
    .sort((x, y) => x[1].at - y[1].at || x[1].seq - y[1].seq);   // server timestamps, then server arrival order
  const results = {};
  const distribution = [0, 0, 0, 0];
  for (const [pid, a] of Object.entries(g.answers)) {
    const p = g.players[pid];
    if (!p) continue;
    distribution[a.choice]++;
    p.answeredCount += 1;
    p.totalMs += a.elapsed;
    results[pid] = { choice: a.choice, correct: a.choice === q.correctIndex, points: 0, elapsed: a.elapsed };
  }
  let fastest = null;
  correct.forEach(([pid, a], i) => {
    const p = g.players[pid];
    if (!p) return;
    const pts = i === 0 ? FIRST_POINTS : OTHER_POINTS;
    p.score += pts; p.correct += 1;
    results[pid].points = pts;
    if (i === 0) fastest = { playerId: pid, name: p.name, elapsed: a.elapsed };
  });
  const prev = {};
  g.reveal = { correctIndex: q.correctIndex, explanation: q.explanation, source: q.source, results, distribution, fastest, prevRanks: g.lastRanks || {} };
  const st = standings(g);
  g.lastRanks = {}; st.forEach(p => { g.lastRanks[p.id] = p.rank; });
  g.phase = 'reveal';
  g.revealAt = Date.now();
  const r = rt(g.code);
  clearTimeout(r.autoTimer);
  if (g.settings.autoAdvance) r.autoTimer = setTimeout(() => advance(g), AUTO_ADVANCE_MS);
  touch(g);
  broadcastNow(g);
}

function advance(g) {
  if (g.phase !== 'reveal') return false;
  if (g.qIndex + 1 >= g.questions.length) finish(g); else beginNextQuestion(g);
  return true;
}

function finish(g) {
  const r = rt(g.code);
  clearTimeout(r.timer); clearTimeout(r.autoTimer);
  g.phase = 'final';
  standings(g);
  touch(g);
  broadcastNow(g);
}

function resetToLobby(g) {
  const r = rt(g.code);
  clearTimeout(r.timer); clearTimeout(r.autoTimer);
  g.phase = 'lobby'; g.questions = []; g.qIndex = -1; g.answers = {}; g.reveal = null; g.lastRanks = {};
  for (const p of Object.values(g.players)) { p.score = 0; p.correct = 0; p.totalMs = 0; p.answeredCount = 0; p.joinedAtQ = -1; }
  touch(g);
  broadcastNow(g);
}

function resumeTimers(g) {
  if (g.phase === 'question') {
    armDeadline(g);
  } else if (g.phase === 'reveal' && g.settings.autoAdvance) {
    const r = rt(g.code);
    r.autoTimer = setTimeout(() => advance(g), Math.max(1000, AUTO_ADVANCE_MS - (Date.now() - g.revealAt)));
  }
}

// ---------- views (what each client is allowed to see) ----------
function isOnline(g, pid) {
  for (const ws of rt(g.code).conns) if (ws.meta.playerId === pid) return true;
  return false;
}
function hostOnline(g) {
  for (const ws of rt(g.code).conns) if (ws.meta.isHost) return true;
  return false;
}
function eligible(g, p) { return g.phase === 'lobby' || p.joinedAtQ < g.qIndex; }

function viewFor(g, ws) {
  const inGame = g.phase !== 'lobby';
  const list = inGame ? standings(g) : Object.values(g.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const me = ws.meta.playerId ? g.players[ws.meta.playerId] : null;
  const q = inGame && (g.phase === 'question' || g.phase === 'reveal') ? g.questions[g.qIndex] : null;
  const view = {
    t: 'state',
    code: g.code,
    phase: g.phase,
    serverNow: Date.now(),
    settings: g.settings,
    hostOnline: hostOnline(g),
    isHost: !!ws.meta.isHost,
    players: list.map((p, i) => ({
      id: p.id, name: p.name, score: p.score, correct: p.correct, isHost: !!p.isHost,
      online: isOnline(g, p.id), rank: inGame ? p.rank : null
    })),
    qIndex: g.qIndex,
    total: inGame ? g.questions.length : Math.min(g.settings.numQuestions, pool(g.settings).length),
    poolSize: pool(g.settings).length,
    question: q ? { index: g.qIndex, text: q.text, options: q.options, category: q.category, difficulty: q.difficulty } : null,
    qMs: QUESTION_MS,
    deadline: g.phase === 'question' ? g.deadline : null,
    answeredCount: g.phase === 'question' || g.phase === 'reveal' ? Object.keys(g.answers).length : 0,
    eligibleCount: inGame ? Object.values(g.players).filter(p => eligible(g, p)).length : 0,
    me: me ? {
      id: me.id, name: me.name,
      choice: (g.phase === 'question' || g.phase === 'reveal') && g.answers[me.id] ? g.answers[me.id].choice : null,
      eligible: eligible(g, me)
    } : null,
    minRevealMs: MIN_REVEAL_MS,
    advanceAt: g.phase === 'reveal' ? g.revealAt + MIN_REVEAL_MS : null,
    isLast: inGame ? g.qIndex + 1 >= g.questions.length : false,
    reveal: null,
    final: null
  };
  if (g.phase === 'reveal' && g.reveal) {
    const names = {};
    for (const p of Object.values(g.players)) names[p.id] = p.name;
    view.reveal = {
      correctIndex: g.reveal.correctIndex,
      explanation: g.reveal.explanation,
      source: g.reveal.source,
      distribution: g.reveal.distribution,
      fastest: g.reveal.fastest,
      prevRanks: g.reveal.prevRanks,
      results: g.reveal.results,
      names
    };
  }
  if (g.phase === 'final') {
    view.final = standings(g).map(p => ({
      id: p.id, name: p.name, rank: p.rank, score: p.score, correct: p.correct,
      avgMs: p.answeredCount ? Math.round(p.totalMs / p.answeredCount) : null, isHost: !!p.isHost
    }));
  }
  return view;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}
function broadcastNow(g) {
  const r = rt(g.code);
  if (r.bcast) { clearTimeout(r.bcast); r.bcast = null; }
  for (const ws of r.conns) send(ws, viewFor(g, ws));
}
function queueBroadcast(g, ms = 80) {
  const r = rt(g.code);
  if (r.bcast) return;
  r.bcast = setTimeout(() => { r.bcast = null; broadcastNow(g); }, ms);
}

// ---------- HTTP ----------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
    "connect-src 'self' ws: wss:; img-src 'self' data:; script-src 'self'; frame-ancestors 'none'");
  next();
});
app.use(express.json({ limit: '4kb' }));

const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const k = req.ip + req.path, now = Date.now();
    const arr = (hits.get(k) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
    arr.push(now); hits.set(k, arr); next();
  };
}

app.get('/api/health', (req, res) => res.json({ ok: true, games: games.size }));
app.get('/api/meta', (req, res) => {
  const counts = {};
  for (const c of CATEGORIES) counts[c] = BANK.filter(q => q.category === c).length;
  const diffs = {};
  for (const d of DIFFICULTIES) diffs[d] = BANK.filter(q => q.difficulty === d).length;
  res.json({ categories: counts, difficulties: diffs, total: BANK.length, questionSeconds: QUESTION_MS / 1000 });
});
app.get('/api/games/:code', (req, res) => {
  const g = games.get(String(req.params.code).toUpperCase());
  if (!g) return res.status(404).json({ error: 'Game not found' });
  res.json({ exists: true, phase: g.phase, players: Object.keys(g.players).length });
});
app.post('/api/games', rateLimit(10, 60000), (req, res) => {
  if (games.size >= MAX_GAMES) return res.status(503).json({ error: 'Server is full. Try again later.' });
  const body = req.body || {};
  const settings = clampSettings(body.settings);
  const available = pool(settings).length;
  if (available < 5) return res.status(400).json({ error: 'Those filters leave fewer than 5 questions. Pick more categories or difficulties.' });
  settings.numQuestions = Math.min(settings.numQuestions, available);
  const code = newCode();
  const hostToken = rndToken();
  const g = {
    code, createdAt: Date.now(), updatedAt: Date.now(), hostHash: sha(hostToken), settings,
    phase: 'lobby', players: {}, questions: [], qIndex: -1, answers: {}, seq: 0, reveal: null, lastRanks: {}
  };
  const out = { code, hostToken };
  if (body.hostPlays) {
    const name = cleanName(body.hostName);
    if (!name) return res.status(400).json({ error: 'Enter your name to play as host.' });
    const playerToken = rndToken();
    const id = rndId();
    g.players[id] = mkPlayer(id, name, playerToken, true);
    out.playerToken = playerToken; out.playerId = id;
  }
  games.set(code, g);
  touch(g);
  res.json(out);
});
function mkPlayer(id, name, token, isHost) {
  return { id, name, key: nameKey(name), tokenHash: sha(token), isHost: !!isHost, score: 0, correct: 0, totalMs: 0, answeredCount: 0, joinedAt: Date.now(), joinedAtQ: -1 };
}

const pub = path.join(__dirname, 'public');
app.use(express.static(pub, { extensions: ['html'], maxAge: '5m' }));
app.get('/g/:code', (req, res) => res.sendFile(path.join(pub, 'index.html')));

// ---------- WebSocket ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

function hostAuthed(g, token) {
  return typeof token === 'string' && token.length > 0 && token.length < 200 && safeEq(sha(token), g.hostHash);
}
function findPlayerByToken(g, token) {
  if (typeof token !== 'string' || !token || token.length > 200) return null;
  const h = sha(token);
  return Object.values(g.players).find(p => safeEq(p.tokenHash, h)) || null;
}
function detach(ws) {
  const code = ws.meta && ws.meta.code;
  if (!code) return;
  const r = runtime.get(code);
  if (r) r.conns.delete(ws);
  const g = games.get(code);
  ws.meta.code = null;
  if (g) queueBroadcast(g, 150);
}

wss.on('connection', ws => {
  ws.meta = { code: null, playerId: null, isHost: false, tokens: 0, windowStart: Date.now() };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    const now = Date.now();
    if (now - ws.meta.windowStart > 1000) { ws.meta.windowStart = now; ws.meta.tokens = 0; }
    if (++ws.meta.tokens > 30) return;
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m !== 'object') return;
    try { handle(ws, m); } catch (e) { console.error('handler error', e); send(ws, { t: 'error', error: 'Server error' }); }
  });
  ws.on('close', () => detach(ws));
  ws.on('error', () => detach(ws));
});

function handle(ws, m) {
  if (m.t === 'ping') return send(ws, { t: 'pong', id: m.id, serverNow: Date.now() });

  if (m.t === 'hello') {
    const code = String(m.code || '').toUpperCase();
    const g = games.get(code);
    if (!g) return send(ws, { t: 'nogame', code });
    if (ws.meta.code) detach(ws);
    ws.meta.code = code; ws.meta.isHost = hostAuthed(g, m.hostToken);
    const p = findPlayerByToken(g, m.playerToken);
    ws.meta.playerId = p ? p.id : null;
    rt(code).conns.add(ws);
    send(ws, viewFor(g, ws));
    queueBroadcast(g, 50);
    return;
  }

  const g = ws.meta.code ? games.get(ws.meta.code) : null;
  if (!g) return send(ws, { t: 'error', error: 'Not in a game' });

  switch (m.t) {
    case 'join': {
      if (ws.meta.playerId && g.players[ws.meta.playerId]) return send(ws, viewFor(g, ws));
      if (g.phase === 'final') return send(ws, { t: 'error', code: 'ended', error: 'This game has finished.' });
      const name = cleanName(m.name);
      if (!name) return send(ws, { t: 'error', code: 'name', error: 'Enter a name (1-20 characters).' });
      if (Object.keys(g.players).length >= MAX_PLAYERS) return send(ws, { t: 'error', code: 'full', error: 'This game is full.' });
      const k = nameKey(name);
      if (Object.values(g.players).some(p => p.key === k)) return send(ws, { t: 'error', code: 'taken', error: `"${name}" is already taken. Try another name.` });
      const token = rndToken(), id = rndId();
      const p = mkPlayer(id, name, token, false);
      p.joinedAtQ = g.phase === 'lobby' ? -1 : g.qIndex;     // late joiners sit out the round in progress
      g.players[id] = p;
      ws.meta.playerId = id;
      touch(g);
      send(ws, { t: 'joined', playerToken: token, playerId: id });
      send(ws, viewFor(g, ws));
      queueBroadcast(g, 40);
      return;
    }
    case 'answer': {
      const p = ws.meta.playerId && g.players[ws.meta.playerId];
      const at = Date.now();
      if (!p) return send(ws, { t: 'rejected', reason: 'not_player' });
      if (g.phase !== 'question') return send(ws, { t: 'rejected', reason: 'closed' });
      if (m.q !== g.qIndex) return send(ws, { t: 'rejected', reason: 'wrong_question' });
      if (at >= g.deadline) return send(ws, { t: 'rejected', reason: 'late' });
      if (!eligible(g, p)) return send(ws, { t: 'rejected', reason: 'joined_late' });
      if (!Number.isInteger(m.choice) || m.choice < 0 || m.choice > 3) return send(ws, { t: 'rejected', reason: 'invalid' });
      if (g.answers[p.id]) return send(ws, { t: 'rejected', reason: 'duplicate', choice: g.answers[p.id].choice });
      g.answers[p.id] = { choice: m.choice, at, elapsed: at - g.startedAt, seq: g.seq++ };
      touch(g);
      send(ws, { t: 'ack', q: g.qIndex, choice: m.choice });
      send(ws, viewFor(g, ws));
      queueBroadcast(g, 120);
      return;
    }
    case 'host': {
      if (!hostAuthed(g, m.hostToken)) return send(ws, { t: 'error', code: 'forbidden', error: 'Only the host can do that.' });
      ws.meta.isHost = true;
      return hostAction(g, ws, m);
    }
    default: return;
  }
}

function hostAction(g, ws, m) {
  switch (m.action) {
    case 'settings':
      if (g.phase !== 'lobby') return;
      g.settings = clampSettings(m.settings, g.settings);
      g.settings.numQuestions = Math.min(g.settings.numQuestions, Math.max(5, pool(g.settings).length));
      touch(g); return broadcastNow(g);
    case 'start':
      if (g.phase !== 'lobby') return;
      if (pool(g.settings).length < 5) return send(ws, { t: 'error', error: 'Not enough questions match those filters.' });
      if (Object.keys(g.players).length < 1) return send(ws, { t: 'error', error: 'Wait for at least one player to join.' });
      return startGame(g);
    case 'next':
      if (g.phase !== 'reveal') return;
      if (Date.now() < g.revealAt + MIN_REVEAL_MS) return send(ws, { t: 'error', code: 'too_soon', error: 'Give players a moment with the answer.' });
      return void advance(g);
    case 'end':
      if (g.phase === 'question' || g.phase === 'reveal') return finish(g);
      return;
    case 'restart':
      if (g.phase === 'lobby') return;
      return resetToLobby(g);
    case 'kick': {
      const p = g.players[String(m.playerId)];
      if (!p || p.isHost) return;
      delete g.players[p.id];
      delete g.answers[p.id];
      for (const c of rt(g.code).conns) if (c.meta.playerId === p.id) { c.meta.playerId = null; send(c, { t: 'kicked' }); }
      touch(g); return broadcastNow(g);
    }
    default: return;
  }
}

// heartbeat: drop dead sockets so presence is accurate
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 25000).unref();

// expire old games
setInterval(() => {
  const now = Date.now();
  for (const [code, g] of games) {
    if (now - g.updatedAt > GAME_TTL_MS) {
      const r = runtime.get(code);
      if (r) { clearTimeout(r.timer); clearTimeout(r.autoTimer); for (const ws of r.conns) ws.close(); }
      runtime.delete(code); games.delete(code);
    }
  }
  for (const [k, arr] of hits) if (!arr.some(t => now - t < 60000)) hits.delete(k);
}, 10 * 60 * 1000).unref();

function shutdown() { if (saveTimer) clearTimeout(saveTimer); saveNow(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

if (require.main === module) {
  loadState();
  server.listen(PORT, () => console.log(`Dandy Trivia listening on :${PORT} (question time ${QUESTION_MS}ms, ${BANK.length} questions)`));
}
module.exports = { server, games, loadState, saveNow };

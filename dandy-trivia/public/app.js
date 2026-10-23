(() => {
'use strict';

// ---------- tiny DOM helper (all text goes through textContent, never innerHTML) ----------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'readOnly') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = k => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) return k.forEach(add);
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}
const $app = document.getElementById('app');
const $conn = document.getElementById('conn');
const $live = document.getElementById('live');
const $toast = document.getElementById('toast');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#14213D"/><path d="M20 18c4-3 8-1 12 0s8-3 12 0c4 4 1 12-1 18s-2 12-6 12-3-8-5-8-1 8-5 8-4-6-6-12-5-14-1-18z" fill="#fff"/></svg>';
const brand = () => { const s = h('span', { class: 'brand' }); s.innerHTML = LOGO; s.appendChild(document.createTextNode('Dandy Trivia')); return s; };

const fmtPts = n => Number(n).toLocaleString('en-US');
const fmtMs = ms => (ms / 1000).toFixed(1) + 's';
const say = msg => { $live.textContent = ''; setTimeout(() => { $live.textContent = msg; }, 30); };
let toastT;
function toast(msg, ms = 2800) { $toast.textContent = msg; $toast.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { $toast.hidden = true; }, ms); }
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

// ---------- app state ----------
const S = { code: null, ws: null, st: null, conn: 'idle', offset: 0, bestRtt: Infinity, pings: new Map(), joinError: '', ui: { key: null }, kicked: false, notFound: false, retry: 0 };
const serverNow = () => Date.now() + S.offset;
const pKey = c => `dandy:${c}:player`, hKey = c => `dandy:${c}:host`;

function codeFromUrl() {
  const m = location.pathname.match(/^\/g\/([A-Za-z0-9]{4,10})/);
  if (m) return m[1].toUpperCase();
  const q = new URLSearchParams(location.search).get('g');
  return q ? q.toUpperCase() : null;
}

// ---------- connection ----------
function connect() {
  clearTimeout(S.retryT);
  if (S.ws && (S.ws.readyState === 0 || S.ws.readyState === 1)) return;
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  S.ws = ws; S.conn = 'connecting';
  ws.addEventListener('open', () => {
    S.conn = 'online'; S.retry = 0; S.bestRtt = Infinity;
    sendHello();
    for (let i = 0; i < 5; i++) setTimeout(ping, i * 180);
    updateConn();
  });
  ws.addEventListener('message', ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } onMessage(m); });
  ws.addEventListener('close', () => {
    if (S.ws === ws) { S.conn = 'offline'; updateConn(); S.retryT = setTimeout(connect, Math.min(4000, 600 * 2 ** S.retry++)); }
  });
  ws.addEventListener('error', () => { try { ws.close(); } catch {} });
}
function sendHello() {
  sendRaw({ t: 'hello', code: S.code, playerToken: ls.get(pKey(S.code)) || undefined, hostToken: ls.get(hKey(S.code)) || undefined });
}
function sendRaw(o) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o)); }
function hostSend(action, extra) { sendRaw(Object.assign({ t: 'host', action, hostToken: ls.get(hKey(S.code)) }, extra || {})); }
function ping() {
  const id = Math.random().toString(36).slice(2);
  S.pings.set(id, performance.now());
  sendRaw({ t: 'ping', id });
}
setInterval(() => { if (S.conn === 'online') ping(); }, 12000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.code) {
    if (!S.ws || S.ws.readyState > 1) connect(); else ping();
  }
});
function updateConn() { $conn.hidden = S.conn === 'online' || !S.code || (!S.st && S.conn === 'connecting'); }

function onMessage(m) {
  switch (m.t) {
    case 'pong': {
      const t0 = S.pings.get(m.id); S.pings.delete(m.id);
      if (t0 == null) return;
      const rtt = performance.now() - t0;
      // keep the sample with the lowest round trip: that is the most accurate clock offset
      if (rtt <= S.bestRtt + 15 || S.pings.size === 0 && rtt < S.bestRtt * 2) {
        if (rtt < S.bestRtt) S.bestRtt = rtt;
        S.offset = m.serverNow + rtt / 2 - Date.now();
      }
      break;
    }
    case 'state':
      if (S.bestRtt === Infinity) S.offset = m.serverNow - Date.now();
      S.notFound = false; S.st = m; render(); break;
    case 'nogame': S.notFound = true; S.st = null; render(); break;
    case 'joined': ls.set(pKey(S.code), m.playerToken); S.joinError = ''; break;
    case 'ack': say('Answer locked in.'); break;
    case 'rejected':
      if (m.reason === 'late' || m.reason === 'closed') toast('Too late. The clock had already run out.');
      else if (m.reason === 'joined_late') toast("You joined mid-round. You're in from the next question.");
      if (S.ui.pending != null && m.reason !== 'duplicate') { S.ui.pending = null; if (S.st) render(); }
      break;
    case 'error':
      if (['name', 'taken', 'full', 'ended'].includes(m.code)) { S.joinError = m.error; render(); }
      else toast(m.error || 'Something went wrong.');
      break;
    case 'kicked': ls.del(pKey(S.code)); S.kicked = true; render(); break;
  }
}

// ---------- render dispatch ----------
let rafId = null, hostTick = null;
function render() {
  updateConn();
  if (!S.code) return screenHome();
  if (S.notFound) return screenMessage('Game not found', 'That game code does not exist or has expired. Ask the host for a fresh link, or start your own game.');
  if (!S.st) return screenMessage('Connecting…', 'Hang tight while we find your game.', true);
  const st = S.st;
  const joined = !!st.me;
  if (S.kicked && !joined) return screenMessage('You were removed', 'The host removed you from this game.');
  if (!joined && !st.isHost) return screenJoin(st);
  if (st.phase === 'lobby') screenLobby(st);
  else if (st.phase === 'question') screenQuestion(st);
  else if (st.phase === 'reveal') screenReveal(st);
  else screenFinal(st);
  renderHostBar(st);
}
function mount(key, build) {
  if (S.ui.key !== key) {
    cancelAnimationFrame(rafId);
    S.ui = { key, pending: null };
    $app.replaceChildren();
    build();
    window.scrollTo(0, 0);
    return true;
  }
  return false;
}

// ---------- screens ----------
function screenMessage(title, text, busy) {
  mount('msg:' + title, () => {
    $app.append(h('div', { class: 'wrap stack center hero' },
      brand(), h('h2', { text: title }), h('p', { class: 'muted', text: text }),
      busy ? h('div', { class: 'waiting', style: 'justify-content:center' }, h('span', { class: 'pulse' }), 'Connecting') :
        h('a', { class: 'btn', href: '/', style: 'display:inline-block;text-decoration:none;line-height:28px' }, 'Create a game')));
  });
  removeHostBar();
}

function screenHome() {
  removeHostBar();
  mount('home', () => {
    const name = h('input', { type: 'text', id: 'hname', maxlength: 20, autocomplete: 'nickname', placeholder: 'Your name' });
    const plays = h('input', { type: 'checkbox', checked: true, id: 'plays' });
    const count = h('select', { id: 'qcount' }, [10, 15, 20, 30].map(n => h('option', { value: n, selected: n === 15 }, `${n} questions`)));
    const auto = h('input', { type: 'checkbox', id: 'auto' });
    const err = h('p', { class: 'err', role: 'alert' });
    const btn = h('button', { class: 'btn big block', type: 'button' }, 'Create game');
    const codeIn = h('input', { type: 'text', class: 'code-input', maxlength: 8, placeholder: 'CODE', 'aria-label': 'Game code', autocapitalize: 'characters', autocomplete: 'off' });
    const go = () => { const c = codeIn.value.trim().toUpperCase(); if (c.length >= 4) { history.pushState(null, '', '/g/' + c); enter(c); } };
    codeIn.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const create = async () => {
      err.textContent = '';
      if (plays.checked && !name.value.trim()) { err.textContent = 'Enter your name to play, or untick "I\'ll play too".'; name.focus(); return; }
      btn.disabled = true;
      try {
        const r = await fetch('/api/games', { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ hostName: name.value, hostPlays: plays.checked, settings: { numQuestions: Number(count.value), autoAdvance: auto.checked } }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Could not create the game.');
        ls.set(hKey(j.code), j.hostToken);
        if (j.playerToken) ls.set(pKey(j.code), j.playerToken);
        history.pushState(null, '', '/g/' + j.code);
        enter(j.code);
      } catch (e) { err.textContent = e.message; btn.disabled = false; }
    };
    btn.addEventListener('click', create);
    name.addEventListener('keydown', e => { if (e.key === 'Enter') create(); });
    $app.append(h('div', { class: 'wrap stack hero' },
      brand(),
      h('div', null, h('h1', { text: 'How well do you know Dandy?' }), h('p', { class: 'lead', text: 'Live trivia for your team. Acronyms, products and digital dentistry, 15 seconds a question.' })),
      h('div', { class: 'card stack' },
        h('h2', { text: 'Host a game' }),
        h('label', { class: 'field', for: 'hname' }, h('span', { text: 'Your name' }), name),
        h('label', { class: 'toggle' }, plays, 'I\'ll play too'),
        h('label', { class: 'field', for: 'qcount' }, h('span', { text: 'Length' }), count),
        h('label', { class: 'toggle' }, auto, 'Advance automatically after each answer'),
        h('p', { class: 'muted small', text: 'You can pick categories and difficulty in the lobby.' }),
        err, btn),
      h('div', { class: 'card flat stack' },
        h('h3', { text: 'Joining a game?' }),
        h('p', { class: 'muted', text: 'Open the link your host shared, or enter the game code.' }),
        h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:160px' }, codeIn), h('button', { class: 'btn ghost', type: 'button', onclick: go }, 'Join')))
    ));
  });
}

function screenJoin(st) {
  removeHostBar();
  const key = 'join:' + st.code;
  const built = mount(key, () => {
    const input = h('input', { type: 'text', id: 'pname', maxlength: 20, autocomplete: 'nickname', placeholder: 'Your name', 'aria-describedby': 'jerr' });
    const err = h('p', { class: 'err', id: 'jerr', role: 'alert' });
    const btn = h('button', { class: 'btn big block', type: 'button' }, 'Join game');
    S.ui.err = err; S.ui.btn = btn; S.ui.input = input;
    const submit = () => { S.joinError = ''; err.textContent = ''; if (!input.value.trim()) { err.textContent = 'Enter a name to join.'; input.focus(); return; } sendRaw({ t: 'join', name: input.value }); };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    S.ui.note = h('div');
    S.ui.count = h('span', { class: 'muted' });
    $app.append(h('div', { class: 'wrap stack hero' },
      brand(),
      h('div', null, h('h1', { text: 'Join the game' }), h('p', { class: 'lead' }, S.ui.count)),
      S.ui.note,
      h('div', { class: 'card stack' }, h('label', { class: 'field', for: 'pname' }, h('span', { text: 'Pick a name your team will recognise' }), input), err, btn)));
    setTimeout(() => input.focus(), 50);
  });
  S.ui.count.textContent = `${st.players.length} ${st.players.length === 1 ? 'player is' : 'players are'} in the lobby.`;
  if (S.joinError) S.ui.err.textContent = S.joinError;
  S.ui.note.replaceChildren(
    st.phase === 'final' ? h('div', { class: 'banner', text: 'This game has finished. Ask the host to play again, then reload this page.' }) :
    st.phase !== 'lobby' ? h('div', { class: 'banner', text: 'A game is already underway. Join now and you will be in from the next question.' }) : null);
}

function playerChips(st, ul, selfId) {
  const prev = new Set([...ul.children].map(c => c.dataset.id));
  const frag = document.createDocumentFragment();
  st.players.forEach(p => {
    const chip = h('li', { class: 'player-chip' + (p.online ? '' : ' off'), 'data-id': p.id, style: 'list-style:none' },
      h('span', { class: 'dot' + (p.online ? ' on' : ''), title: p.online ? 'online' : 'offline' }),
      p.name,
      p.id === selfId ? h('span', { class: 'you', text: 'you' }) : null,
      p.isHost ? h('span', { class: 'you', text: 'host' }) : null,
      st.isHost && !p.isHost ? h('button', { 'aria-label': 'Remove ' + p.name, title: 'Remove', onclick: () => hostSend('kick', { playerId: p.id }) }, '×') : null);
    if (prev.has(p.id)) chip.style.animation = 'none';
    frag.appendChild(chip);
  });
  ul.replaceChildren(frag);
}

function screenLobby(st) {
  const key = 'lobby:' + st.code + ':' + st.isHost;
  mount(key, () => {
    const u = S.ui;
    u.count = h('span', { class: 'big-count' });
    u.countLabel = h('span', { class: 'muted' });
    u.list = h('ul', { class: 'players', style: 'padding:0;margin:14px 0 0', 'aria-label': 'Players' });
    u.wait = h('div', { class: 'waiting', role: 'status' });
    const link = location.origin + '/g/' + st.code;
    const parts = [
      h('div', { class: 'row between' }, brand(), h('span', { class: 'pill', text: 'Code ' + st.code })),
      h('div', null, h('h1', { text: st.isHost ? 'Your game is open' : "You're in!" })),
      u.wait
    ];
    if (st.isHost) {
      const input = h('input', { type: 'text', readOnly: true, value: link, 'aria-label': 'Game link' });
      input.addEventListener('focus', () => input.select());
      const copy = h('button', { class: 'btn', type: 'button' }, 'Copy link');
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(link); } catch { input.select(); document.execCommand('copy'); }
        copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy link'; }, 1800);
      });
      parts.push(h('div', { class: 'card stack' }, h('h3', { text: 'Share this link with your team' }), h('div', { class: 'sharebox' }, input, copy)));
      parts.push(settingsPanel(st, u));
    }
    parts.push(h('div', { class: 'card' }, h('div', { class: 'row' }, u.count, u.countLabel), u.list));
    $app.append(h('div', { class: 'wrap stack' }, parts));
  });
  const u = S.ui;
  u.count.textContent = st.players.length;
  u.countLabel.textContent = st.players.length === 1 ? 'player joined' : 'players joined';
  playerChips(st, u.list, st.me && st.me.id);
  u.wait.replaceChildren(h('span', { class: 'pulse' }), st.isHost
    ? (st.players.length ? 'Waiting for your go. Start when everyone has arrived.' : 'Waiting for players to join with your link.')
    : 'Waiting for the host to start the game…');
  if (u.syncSettings) u.syncSettings(st);
}

function settingsPanel(st, u) {
  const CATS = ['Dandy Acronyms', 'Dental Terms', 'Teams & Workflows', 'Business Lingo', 'Company Facts', 'Products & Digital Dentistry', 'Culture & Fun'];
  const DIFFS = ['easy', 'medium', 'hard'];
  const sel = { categories: new Set(st.settings.categories), difficulties: new Set(st.settings.difficulties) };
  let timer;
  const push = () => { clearTimeout(timer); timer = setTimeout(() => hostSend('settings', { settings: { numQuestions: Number(num.value), categories: [...sel.categories], difficulties: [...sel.difficulties], autoAdvance: auto.checked } }), 250); };
  const num = h('select', { id: 'nq', onchange: push }, [5, 10, 15, 20, 25, 30, 40, 50].map(n => h('option', { value: n }, `${n} questions`)));
  const auto = h('input', { type: 'checkbox', onchange: push });
  const chip = (set, value, label) => {
    const c = h('span', { class: 'chip', role: 'checkbox', tabindex: 0, 'aria-checked': String(set.has(value)) }, label);
    const flip = () => { set.has(value) ? set.delete(value) : set.add(value); c.setAttribute('aria-checked', String(set.has(value))); push(); };
    c.addEventListener('click', flip);
    c.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
    return c;
  };
  const info = h('p', { class: 'muted small', role: 'status' });
  u.syncSettings = s => {
    if (document.activeElement !== num) num.value = String(s.settings.numQuestions);
    if (!num.value) num.value = String(s.settings.numQuestions);
    auto.checked = s.settings.autoAdvance;
    info.textContent = `${s.poolSize} questions match your filters. This game will use ${s.total}.`;
  };
  u.syncSettings(st);
  return h('details', { class: 'card settings' }, h('summary', null, 'Game settings'),
    h('div', { class: 'stack', style: 'margin-top:8px' },
      h('label', { class: 'field', for: 'nq' }, h('span', { text: 'Length' }), num),
      h('div', null, h('strong', { text: 'Categories' }), h('p', { class: 'muted small', text: 'None selected means all categories.' }), h('div', { class: 'opts' }, CATS.map(c => chip(sel.categories, c, c)))),
      h('div', null, h('strong', { text: 'Difficulty' }), h('div', { class: 'opts' }, DIFFS.map(d => chip(sel.difficulties, d, d[0].toUpperCase() + d.slice(1))))),
      h('label', { class: 'toggle' }, auto, 'Advance automatically after each answer'),
      info));
}

// ----- question -----
function screenQuestion(st) {
  const q = st.question;
  const canAnswer = !!(st.me && st.me.eligible);
  mount(`q:${st.code}:${q.index}`, () => {
    const u = S.ui;
    u.timeNum = h('span', { class: 'num', 'aria-hidden': 'true' });
    const C = 2 * Math.PI * 54;
    u.C = C;
    u.bar = h('circle', { class: 'bar', cx: 60, cy: 60, r: 54, fill: 'none', 'stroke-width': 10 });
    u.bar.style.strokeDasharray = C;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('class', 'track'); track.setAttribute('cx', 60); track.setAttribute('cy', 60); track.setAttribute('r', 54); track.setAttribute('fill', 'none'); track.setAttribute('stroke-width', 10);
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ['class', 'cx', 'cy', 'r', 'fill', 'stroke-width'].forEach(a => bar.setAttribute(a, u.bar.getAttribute(a)));
    bar.style.strokeDasharray = C; u.bar = bar;
    svg.append(track, bar);
    u.timer = h('div', { class: 'timer', role: 'timer', 'aria-label': 'Time remaining' }, svg, u.timeNum);
    u.status = h('p', { class: 'status', role: 'status' });
    u.progress = h('i');
    u.progLabel = h('span', { class: 'muted small' });
    u.btns = q.options.map((opt, i) => {
      const tag = h('span', { class: 'tag' });
      const b = h('button', { class: 'answer', type: 'button', 'aria-label': `Answer ${'ABCD'[i]}: ${opt}`, disabled: !canAnswer, onclick: () => choose(i) },
        h('span', { class: 'letter', 'aria-hidden': 'true' }, 'ABCD'[i]), h('span', { text: opt }), tag);
      b._tag = tag; return b;
    });
    $app.append(h('div', { class: 'wrap stack' },
      h('div', { class: 'qhead' },
        h('div', { class: 'qmeta' }, h('span', { class: 'qcount', text: `Question ${q.index + 1} of ${st.total}` }), h('span', { class: 'pill', text: q.category }), h('span', { class: 'pill ' + q.difficulty, text: q.difficulty })),
        u.timer),
      h('h2', { class: 'question-text', text: q.text }),
      h('div', { class: 'answers', role: 'group', 'aria-label': 'Answer choices' }, u.btns),
      u.status,
      h('div', null, h('div', { class: 'progress', 'aria-hidden': 'true' }, u.progress), u.progLabel)));
    say(`Question ${q.index + 1}. ${q.text}`);
    tickTimer(st);
  });
  const u = S.ui;
  u.deadline = st.deadline; u.qMs = st.qMs;
  const mine = st.me && st.me.choice != null ? st.me.choice : u.pending;
  u.btns.forEach((b, i) => {
    b.classList.toggle('picked', mine === i);
    b.classList.toggle('dim', mine != null && mine !== i);
    b.disabled = !canAnswer || mine != null;
    b._tag.textContent = mine === i ? 'Locked in' : '';
  });
  u.locked = mine != null;
  const timeUp = u.deadline - serverNow() <= 0;
  u.status.className = 'status' + (mine != null ? ' ok' : '');
  u.status.textContent = !st.me ? (st.isHost ? 'Hosting: players are answering now.' : '')
    : !st.me.eligible ? "You joined mid-round, so you're watching this one. You're in from the next question."
    : mine != null ? '✓ Answer locked in. Results appear when the clock hits zero.'
    : timeUp ? "Time's up!" : 'Pick one. You get a single answer.';
  u.progress.style.width = st.eligibleCount ? Math.round(100 * st.answeredCount / st.eligibleCount) + '%' : '0%';
  u.progLabel.textContent = `${st.answeredCount} of ${st.eligibleCount} answered`;
}
function choose(i) {
  const u = S.ui;
  if (u.locked || u.pending != null || !S.st || S.st.phase !== 'question') return;
  if (u.deadline - serverNow() <= 0) { toast("Time's up!"); return; }
  u.pending = i;
  sendRaw({ t: 'answer', q: S.st.question.index, choice: i });
  render();
}
function tickTimer(st0) {
  const u = S.ui;
  const frame = () => {
    if (!S.st || S.st.phase !== 'question' || !u.timeNum || !u.timeNum.isConnected) return;
    const rem = Math.max(0, (u.deadline || st0.deadline) - serverNow());
    const total = u.qMs || st0.qMs;
    u.bar.style.strokeDashoffset = u.C * (1 - rem / total);
    const secs = Math.ceil(rem / 1000);
    if (u.timeNum.textContent !== String(secs)) {
      u.timeNum.textContent = secs;
      u.timer.setAttribute('aria-label', secs + ' seconds left');
      if (secs === 5 || secs === 0) { /* low-time styling handled below */ }
    }
    u.timer.classList.toggle('low', rem <= 5000);
    if (rem === 0 && !u.timeUpShown) { u.timeUpShown = true; if (S.st) screenQuestion(S.st); }
    rafId = requestAnimationFrame(frame);
  };
  cancelAnimationFrame(rafId); rafId = requestAnimationFrame(frame);
}

// ----- reveal -----
function screenReveal(st) {
  const q = st.question, rv = st.reveal;
  if (!rv) return;
  mount(`r:${st.code}:${q.index}`, () => {
    const u = S.ui;
    const myRes = st.me ? rv.results[st.me.id] : null;
    const total = rv.distribution.reduce((a, b) => a + b, 0) || 1;
    const cards = q.options.map((opt, i) => {
      const isRight = i === rv.correctIndex, mine = myRes && myRes.choice === i;
      const cls = 'answer' + (isRight ? ' correct' : mine ? ' wrong' : ' dim');
      const tag = isRight ? (mine ? '✓ Correct · your answer' : '✓ Correct') : mine ? '✕ Your answer' : '';
      return h('div', { class: cls, role: 'group', 'aria-label': `${'ABCD'[i]}: ${opt}. ${isRight ? 'Correct answer.' : mine ? 'Your incorrect answer.' : ''} ${rv.distribution[i]} players chose this.` },
        h('span', { class: 'letter', 'aria-hidden': 'true' }, 'ABCD'[i]),
        h('span', null, opt),
        h('span', { class: 'tag' }, tag),
        h('span', { class: 'bar', style: `width:${Math.round(100 * rv.distribution[i] / total)}%` }));
    });
    let banner;
    if (!st.me) banner = null;
    else if (!myRes) banner = h('div', { class: 'result none' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '–'), h('span', null, st.me.eligible ? 'No answer this round' : 'You were watching this round'), h('span', { class: 'pts', text: '+0' }));
    else if (myRes.correct) banner = h('div', { class: 'result good' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '✓'), h('span', null, myRes.points === 1000 ? 'Correct, and fastest!' : 'Correct!'), h('span', { class: 'pts', text: '+' + fmtPts(myRes.points) }));
    else banner = h('div', { class: 'result bad' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '✕'), h('span', null, 'Not this time'), h('span', { class: 'pts', text: '+0' }));
    if (banner) say(banner.textContent);
    const fast = rv.fastest
      ? h('p', { class: 'fast' }, h('span', { 'aria-hidden': 'true' }, '⚡'), h('span', null, h('strong', { text: rv.fastest.name }), ` had the fastest correct answer (${fmtMs(rv.fastest.elapsed)}).`))
      : h('p', { class: 'fast muted' }, 'Nobody got that one right.');
    u.next = h('p', { class: 'muted center', role: 'status' });
    $app.append(h('div', { class: 'wrap stack' },
      h('div', { class: 'qmeta' }, h('span', { class: 'qcount', text: `Question ${q.index + 1} of ${st.total}` }), h('span', { class: 'pill', text: q.category })),
      h('h2', { class: 'question-text', style: 'margin:8px 0 0', text: q.text }),
      h('div', { class: 'answers' }, cards),
      banner,
      fast,
      h('div', { class: 'card explain' }, h('strong', { text: 'Why: ' }), rv.explanation, h('p', { class: 'src', text: 'Source: ' + rv.source })),
      h('h3', { text: 'Leaderboard' }),
      leaderboard(st),
      u.next));
  });
  const u = S.ui;
  const txt = st.isHost ? '' : st.hostOnline ? (st.settings.autoAdvance ? 'Next question starts automatically.' : 'Waiting for the host to continue…') : 'The host has disconnected. The game will continue when they return.';
  u.next.textContent = txt;
}

function leaderboard(st) {
  const rv = st.reveal, me = st.me && st.me.id;
  const rows = st.players;
  const top = rows.slice(0, 10);
  const mine = me ? rows.find(p => p.id === me) : null;
  const extra = mine && !top.some(p => p.id === mine.id) ? mine : null;
  const ul = h('ul', { class: 'board', 'aria-label': 'Leaderboard' });
  const li = p => {
    const r = rv.results[p.id];
    const prev = rv.prevRanks[p.id];
    const mv = prev && prev !== p.rank ? (prev > p.rank ? h('span', { class: 'mv up', 'aria-label': `up ${prev - p.rank}` }, '▲' + (prev - p.rank)) : h('span', { class: 'mv down', 'aria-label': `down ${p.rank - prev}` }, '▼' + (p.rank - prev))) : null;
    const mark = r ? (r.correct ? h('span', { class: 'mark y', 'aria-label': 'answered correctly', title: 'Correct' }, '✓') : h('span', { class: 'mark n', 'aria-label': 'answered incorrectly', title: 'Incorrect' }, '✕')) : h('span', { class: 'mark z', 'aria-label': 'no answer', title: 'No answer' }, '–');
    const sc = h('span', { class: 'sc' });
    const gain = r && r.points ? h('span', { class: 'gain', text: '+' + fmtPts(r.points) }) : null;
    const el = h('li', { class: p.id === me ? 'me' : '' },
      h('span', { class: 'rk', text: p.rank }), h('span', { class: 'nm' }, p.name, p.id === me ? h('small', { text: ' (you)' }) : null, mv), mark, h('span', null, gain, sc));
    const from = p.score - (r ? r.points : 0);
    countUp(sc, from, p.score);
    el._prevIdx = prev ? prev - 1 : null; el._idx = p.rank - 1;
    return el;
  };
  top.forEach(p => ul.appendChild(li(p)));
  if (extra) { ul.appendChild(h('li', { style: 'background:none;border:0;min-height:20px;display:block;text-align:center;color:var(--muted);padding:0' }, '⋯')); ul.appendChild(li(extra)); }
  requestAnimationFrame(() => {
    if (reduceMotion) return;
    [...ul.children].forEach(el => {
      if (el._prevIdx != null && el._prevIdx !== el._idx && el._prevIdx < 12) {
        const dy = (el._prevIdx - el._idx) * 60;
        el.animate([{ transform: `translateY(${dy}px)`, zIndex: 2 }, { transform: 'translateY(0)', zIndex: 2 }], { duration: 750, easing: 'cubic-bezier(.2,.9,.3,1)', delay: 250 });
      }
    });
  });
  return ul;
}
function countUp(el, from, to) {
  el.textContent = fmtPts(from);
  if (reduceMotion || from === to) { el.textContent = fmtPts(to); return; }
  const t0 = performance.now() + 250, dur = 700;
  const step = now => {
    const t = Math.min(1, Math.max(0, (now - t0) / dur));
    el.textContent = fmtPts(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ----- final -----
function screenFinal(st) {
  const f = st.final || [];
  mount('final:' + st.code, () => {
    const me = st.me && st.me.id;
    const w = f[0];
    const pod = (p, cls, medal) => p ? h('div', { class: 'pod ' + cls }, cls === 'p1' ? h('div', { class: 'crown', 'aria-hidden': 'true' }, '👑') : null,
      h('div', { class: 'who', text: p.name }), h('div', { class: 'pts', text: fmtPts(p.score) + ' pts' }), h('div', { class: 'block', 'aria-hidden': 'true' }, medal)) : h('div');
    const tied = f.length > 1 && f[0].score === f[1].score;
    const win = w ? `${w.name} wins with ${fmtPts(w.score)} points!` : 'Game over';
    say(win);
    $app.append(h('div', { class: 'wrap wide stack final' },
      h('div', { class: 'row between' }, brand(), h('span', { class: 'pill', text: 'Final results' })),
      h('h1', { text: win }),
      tied ? h('p', { class: 'tiebreak', text: 'Tied on points: decided by correct answers, then average response time.' }) : null,
      h('div', { class: 'podium' }, pod(f[1], 'p2', '2'), pod(f[0], 'p1', '1'), pod(f[2], 'p3', '3')),
      h('table', { class: 'results' },
        h('caption', { class: 'sr', text: 'Final standings' }),
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: '#' }), h('th', { scope: 'col', text: 'Player' }), h('th', { class: 'num', scope: 'col', text: 'Points' }), h('th', { class: 'num', scope: 'col', text: 'Correct' }), h('th', { class: 'num', scope: 'col', text: 'Avg. time' }))),
        h('tbody', null, f.map(p => h('tr', { class: p.id === me ? 'me' : '' },
          h('td', { text: p.rank }), h('td', { text: p.name + (p.id === me ? ' (you)' : '') }), h('td', { class: 'num', text: fmtPts(p.score) }), h('td', { class: 'num', text: p.correct }), h('td', { class: 'num', text: p.avgMs == null ? '–' : fmtMs(p.avgMs) })))))));
    confetti();
  });
}
function confetti() {
  if (reduceMotion) return;
  const cv = document.getElementById('confetti'), ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const colors = ['#2F4BFF', '#FFC83D', '#12B886', '#FF6B81', '#8B5CF6', '#14213D'];
  const bits = Array.from({ length: 140 }, () => ({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .6, vx: (Math.random() - .5) * 2.4, vy: 2 + Math.random() * 3.5, s: 6 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: colors[Math.floor(Math.random() * colors.length)] }));
  const t0 = performance.now();
  const loop = now => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bits.forEach(b => { b.x += b.vx; b.y += b.vy; b.r += b.vr; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); });
    if (now - t0 < 4500) requestAnimationFrame(loop); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(loop);
}

// ---------- host bar ----------
let bar = null;
function removeHostBar() { if (bar) { bar.el.remove(); bar = null; } clearInterval(hostTick); }
function renderHostBar(st) {
  if (!st.isHost) return removeHostBar();
  const key = st.phase + (st.phase === 'reveal' ? st.isLast : '');
  if (!bar || bar.key !== key) {
    removeHostBar();
    const label = h('div', { class: 'lbl' });
    const actions = h('div', { class: 'row' });
    const el = h('div', { class: 'hostbar', role: 'region', 'aria-label': 'Host controls' }, h('div', { class: 'in' }, label, actions));
    bar = { key, el, label, actions };
    const endBtn = () => h('button', { class: 'btn danger', type: 'button', onclick: () => { if (confirm('End the game now and show final results?')) hostSend('end'); } }, 'End game');
    if (st.phase === 'lobby') {
      bar.start = h('button', { class: 'btn', type: 'button', onclick: () => hostSend('start') }, 'Start game');
      actions.append(bar.start);
    } else if (st.phase === 'question') {
      actions.append(endBtn());
    } else if (st.phase === 'reveal') {
      bar.next = h('button', { class: 'btn', type: 'button', onclick: () => hostSend('next') });
      actions.append(bar.next);
      if (!st.isLast) actions.append(endBtn());
      hostTick = setInterval(() => updateNext(), 250);
    } else {
      actions.append(h('button', { class: 'btn', type: 'button', onclick: () => hostSend('restart') }, 'Play again'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { history.pushState(null, '', '/'); location.reload(); } }, 'New game'));
    }
    document.body.appendChild(el);
  }
  const lbl = bar.label;
  if (st.phase === 'lobby') { lbl.replaceChildren('Host controls', h('small', { text: `${st.players.length} in the lobby · ${st.total} questions` })); bar.start.disabled = st.players.length < 1; }
  else if (st.phase === 'question') lbl.replaceChildren(`Question ${st.question.index + 1} of ${st.total}`, h('small', { text: `${st.answeredCount} of ${st.eligibleCount} answered` }));
  else if (st.phase === 'reveal') { lbl.replaceChildren('Host controls', h('small', { text: st.settings.autoAdvance ? 'Auto-advance is on' : 'Continue when everyone has read the answer' })); updateNext(); }
  else lbl.replaceChildren('Game over', h('small', { text: 'Play again with the same players, or start fresh.' }));
}
function updateNext() {
  if (!bar || !bar.next || !S.st) return;
  const left = Math.max(0, S.st.advanceAt - serverNow());
  bar.next.disabled = left > 0;
  const base = S.st.isLast ? 'See final results' : 'Next question';
  bar.next.textContent = left > 0 ? `${base} (${Math.ceil(left / 1000)})` : base;
}

// ---------- boot ----------
function enter(code) {
  S.code = code; S.st = null; S.notFound = false; S.kicked = false; S.joinError = ''; S.ui = { key: null };
  removeHostBar();
  if (S.ws) { try { S.ws.close(); } catch {} S.ws = null; }
  render();
  connect();
}
window.addEventListener('popstate', () => { const c = codeFromUrl(); if (c) enter(c); else { S.code = null; S.st = null; S.ui = { key: null }; if (S.ws) { S.ws.close(); S.ws = null; } render(); } });
document.addEventListener('keydown', e => {
  if (!S.st || S.st.phase !== 'question' || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
  const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
  if (i >= 0 && i < 4 && S.ui.btns && S.ui.btns[i] && !S.ui.btns[i].disabled) choose(i);
});
const initial = codeFromUrl();
if (initial) enter(initial); else render();
})();
